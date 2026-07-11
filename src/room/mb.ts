import OBR, { Metadata } from "@owlbear-rodeo/sdk"
import { logEvent } from "firebase/analytics"
import { v4 as uuidv4 } from "uuid"
import { Action, getPlaybackOffset, prepareTrackSelection, resetTrackProgress, TrackProgressMap } from "../domain/playback"
import { Track } from "../domain/track"
import { analytics } from "../infra/firebase"
import { now } from "../infra/time"
import { ObrError } from "../shared/errors"
import { checkTrack, convertToDirectDownloadable } from "../shared/utils"
import {
  controlPath,
  extractControlMessage,
  extractProgressMap,
  progressPath,
  RoomControlMessage,
} from "./metadataSchema"
import {
  clearControlAndWriteProgress,
  writeControlAndProgress,
} from "./stateOperations"

export { controlPath }

export { Action }

export type Message = RoomControlMessage

function newPlayMessage(
  track: Track,
  duration: number,
  offset = 0,
): Message {
  return {
    id: uuidv4(),
    time: now(),
    action: Action.Play,
    offset,
    duration: duration,
    track: track,
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
let currentProgress: TrackProgressMap = {}

function getCurrentOffset(message: Message) {
  return getPlaybackOffset(message.offset, message.time, now())
}

export function onMessage(
  callback: (message: Message | undefined) => void,
): () => void {
  const handler = (m: Metadata) => {
    const message = extractControlMessage(m)
    currentProgress = extractProgressMap(m)

    if (message?.id !== currentMessage?.id) {
      // A future message means means there is a massive clock skew issue,
      // so don't allow it. Instead, set the message time to now.
      const n = now()
      if (message && new Date(message.time).getTime() > n.getTime()) {
        console.warn(
          `message came from the future\nmessage time: ${message.time}\nnow: ${n}\nsetting message time to now`,
        )
        message.time = n
      }

      logEvent(analytics, "message_received", { action: message?.action })
      currentMessage = message
      console.log(`now: ${n}\ntracks message: `, message)
      callback(currentMessage)
    }
  }

  OBR.room.getMetadata().then(handler)
  console.log("[mb] onMessage() registered and callingOnMetadataChange")
  return OBR.room.onMetadataChange(handler)
}

export function play(track: Track) {
  logEvent(analytics, "play")

  // validate the track
  const { fixed, validation } = checkTrack(track)
  if (validation) {
    throw new ObrError("Track validation failed", fixed, validation)
  }

  // convert url into direct downloadable if applicable
  fixed.url = convertToDirectDownloadable(fixed.url)

  const { progressMap, offset } = prepareTrackSelection(
    fixed,
    currentProgress,
    currentMessage?.track,
    currentMessage && currentMessage.action === Action.Play
      ? getCurrentOffset(currentMessage)
      : undefined,
    currentMessage?.action,
  )
  currentProgress = progressMap

  // test the url
  const audio = new Audio()
  audio.preload = "metadata"
  audio.onerror = () => {
    throw new ObrError("Audio error: Unable to play track", fixed)
  }
  audio.onloadedmetadata = () => {
    writeControlAndProgress(
      newPlayMessage(fixed, audio.duration, offset),
      currentProgress,
    )
  }

  audio.src = fixed.url
}

export function pause() {
  console.log("mb currentMessage", currentMessage)

  logEvent(analytics, "pause")
  if (!currentMessage) {
    throw new ObrError("Unable to pause before receiving first message")
  }

  currentProgress = {
    ...currentProgress,
    [currentMessage.track.url]: getCurrentOffset(currentMessage),
  }

  writeControlAndProgress(pauseCurrentMessage(), currentProgress)
}

export function resume() {
  logEvent(analytics, "resume")
  writeControlAndProgress(resumeCurrentMessage(), currentProgress)
}

export function stop() {
  console.log("[mb] stop() called")
  stopPlayback()

  clearControlAndWriteProgress(currentProgress)
}

export function stopPlayback() {
  logEvent(analytics, "stop")

  if (currentMessage) {
    currentProgress = resetTrackProgress(currentProgress, currentMessage.track)
  }
}
