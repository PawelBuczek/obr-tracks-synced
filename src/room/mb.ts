import OBR, { Metadata } from "@owlbear-rodeo/sdk"
import { v4 as uuidv4 } from "uuid"
import { Action, getPlaybackOffset } from "../domain/playback"
import { canonicalizeTrackUrl, Track } from "../domain/track"
import { now } from "../infra/time"
import { ObrError } from "../shared/errors"
import { key } from "../shared/key"
import { checkTrack, convertToDirectDownloadable } from "../shared/utils"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  RoomControlMessage,
} from "./metadataSchema"
import {
  clearControlAndWriteProgress,
  writeControlAndProgress,
} from "./state/playbackWrites"

export { controlPath }

export { Action }

export type Message = RoomControlMessage

// Ephemeral (non-persisted) live scrub position, sent while the GM drags the seek slider.
const seekPreviewChannel = key("seekPreviewBroadcast")

export interface SeekPreviewMessage {
  trackUrl: string
  offsetSeconds: number
}

function isSeekPreviewMessage(value: unknown): value is SeekPreviewMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as SeekPreviewMessage).trackUrl === "string" &&
    Number.isFinite((value as SeekPreviewMessage).offsetSeconds)
  )
}

// UI-only hint, not authoritative: the real seek is still gated by ensureGmCanSeek in seekToOffset.
export function broadcastSeekPreview(offsetSeconds: number) {
  if (!currentMessage) {
    return
  }

  const message: SeekPreviewMessage = {
    trackUrl: canonicalizeTrackUrl(currentMessage.track.url),
    offsetSeconds,
  }

  void OBR.broadcast.sendMessage(seekPreviewChannel, message).catch(error => {
    console.warn("Failed to broadcast seek preview:", error)
  })
}

export function onSeekPreview(
  callback: (message: SeekPreviewMessage) => void,
): () => void {
  return OBR.broadcast.onMessage(seekPreviewChannel, event => {
    if (isSeekPreviewMessage(event.data)) {
      callback(event.data)
    }
  })
}

function sameTags(left: Array<number | string>, right: Array<number | string>): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((tag, index) => String(tag) === String(right[index]))
}

function isSameMessage(
  left: Message | undefined,
  right: Message | undefined,
): boolean {
  if (left === right) {
    return true
  }

  if (!left || !right) {
    return false
  }

  return (
    left.id === right.id &&
    left.action === right.action &&
    left.offset === right.offset &&
    left.duration === right.duration &&
    left.time.getTime() === right.time.getTime() &&
    left.track.title === right.track.title &&
    left.track.url === right.track.url &&
    sameTags(left.track.tags, right.track.tags)
  )
}

function newPlayMessage(
  track: Track,
  duration: number,
  offset = 0,
): Message {
  const { offset: _rowOffset, ...controlTrack } = track
  return {
    id: uuidv4(),
    time: now(),
    action: Action.Play,
    offset,
    duration: duration,
    track: controlTrack,
  }
}

function pauseCurrentMessage(): Message {
  if (!currentMessage) {
    throw new ObrError("Unable to pause before receiving first message")
  }

  const m = newPlayMessage(
    currentMessage.track,
    currentMessage.duration,
    getCurrentOffset(currentMessage),
  )
  m.action = Action.Pause
  return m
}

function resumeCurrentMessage(): Message {
  if (!currentMessage) {
    throw new ObrError("Unable to resume before receiving first message")
  }

  const m = newPlayMessage(currentMessage.track, currentMessage.duration)
  m.action = Action.Play
  m.offset = currentMessage.offset
  return m
}

// message cache
let currentMessage: Message | undefined = undefined
let currentLibrary: Track[] = []

function getCurrentOffset(message: Message) {
  return getPlaybackOffset(message.offset, message.time, now())
}

export function getCachedTrackOffset(trackUrl: string): number | undefined {
  return currentLibrary.find(track =>
    canonicalizeTrackUrl(track.url) === canonicalizeTrackUrl(trackUrl),
  )?.offset
}

async function ensureGmCanSeek() {
  const role = await OBR.player.getRole()
  if (role !== "GM") {
    throw new ObrError("Only the GM can change track progress")
  }
}

export function onMessage(
  callback: (message: Message | undefined) => void,
): () => void {
  const handler = (m: Metadata) => {
    const message = extractControlMessage(m)
    currentLibrary = extractLibrary(m)

    if (!isSameMessage(message, currentMessage)) {
      // A future message means means there is a massive clock skew issue,
      // so don't allow it. Instead, set the message time to now.
      const n = now()
      if (message && new Date(message.time).getTime() > n.getTime()) {
        console.warn(
          `message came from the future\nmessage time: ${message.time}\nnow: ${n}\nsetting message time to now`,
        )
        message.time = n
      }

      currentMessage = message
      callback(currentMessage)
    }
  }

  OBR.room.getMetadata().then(handler)
  return OBR.room.onMetadataChange(handler)
}

export function play(track: Track) {

  // validate the track
  const { fixed, validation } = checkTrack(track)
  if (validation) {
    throw new ObrError("Track validation failed", fixed, validation)
  }

  // convert url into direct downloadable if applicable
  fixed.url = convertToDirectDownloadable(fixed.url)

  const offset = getCachedTrackOffset(fixed.url) ?? 0

  // test the url
  const audio = new Audio()
  audio.preload = "metadata"
  audio.onerror = () => {
    throw new ObrError("Audio error: Unable to play track", fixed)
  }
  audio.onloadedmetadata = () => {
    const previousTrack = currentMessage?.track
    const previousOffset =
      currentMessage?.action === Action.Play && currentMessage
        ? getCurrentOffset(currentMessage)
        : undefined
    writeControlAndProgress(newPlayMessage(fixed, audio.duration, offset), {
      saveTrack: previousTrack,
      saveOffset: previousOffset,
    })
  }

  audio.src = fixed.url
}

export function pause() {
  if (!currentMessage) {
    throw new ObrError("Unable to pause before receiving first message")
  }

  const expectedControlId = currentMessage.id
  writeControlAndProgress(pauseCurrentMessage(), {
    expectedControlId,
  })
}

export function resume() {
  if (!currentMessage) {
    throw new ObrError("Unable to resume before receiving first message")
  }

  const expectedControlId = currentMessage.id
  writeControlAndProgress(resumeCurrentMessage(), {
    expectedControlId,
  })
}

export function stop() {
  const activeTrack = currentMessage?.track
  stopPlayback()

  clearControlAndWriteProgress(activeTrack)
}

export function stopPlayback() {
  // Local playback stops reactively when the control message is cleared;
  // this hook exists for callers/tests to signal that intent explicitly.
}

export async function seekToOffset(offsetSeconds: number) {
  await ensureGmCanSeek()

  if (!currentMessage) {
    throw new ObrError("Unable to seek before receiving first message")
  }

  // Clamp offset to valid range [0, duration)
  const clampedOffset = Math.max(0, Math.min(offsetSeconds, currentMessage.duration - 0.001))

  if (currentMessage.action === Action.Pause) {
    // If paused, just update the offset and stay paused
    const updatedMessage = newPlayMessage(
      currentMessage.track,
      currentMessage.duration,
      clampedOffset,
    )
    updatedMessage.action = Action.Pause

    const expectedControlId = currentMessage.id
    writeControlAndProgress(updatedMessage, {
      expectedControlId,
    })
  } else {
    // If playing, resume from the new offset
    const updatedMessage = newPlayMessage(
      currentMessage.track,
      currentMessage.duration,
      clampedOffset,
    )
    updatedMessage.action = Action.Play

    const expectedControlId = currentMessage.id
    writeControlAndProgress(updatedMessage, {
      expectedControlId,
    })
  }
}
