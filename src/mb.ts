import OBR, { Metadata } from "@owlbear-rodeo/sdk"
import { logEvent } from "firebase/analytics"
import { v4 as uuidv4 } from "uuid"
import { ObrError } from "./errors"
import { analytics } from "./firebase"
import { key } from "./key"
import { now } from "./time"
import { Track } from "./track"
import {
  Action,
  prepareTrackSelection,
  resetTrackProgress,
  TrackProgressMap,
} from "./playback"
import { checkTrack, convertToDirectDownloadable, getSeconds } from "./utils"

const path = key("control")
const progressPath = key("progress")

export { Action }

export interface Message {
  id: string
  time: Date
  action: Action
  offset: number
  duration: number
  track: Track
}

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

function isMessage(value: unknown): value is Message {
  if (value === undefined) {
    return false
  }

  const { id, time, action, offset, duration, track } = value as Message
  return (
    id !== undefined &&
    time !== undefined &&
    action !== undefined &&
    offset !== undefined &&
    duration !== undefined &&
    track !== undefined
  )
}

function extractMessage(metadata: Metadata): Message | undefined {
  const data = metadata[path]
  if (isMessage(data)) {
    return data
  }
  return undefined
}

function extractProgress(metadata: Metadata): TrackProgressMap {
  const data = metadata[progressPath]
  if (data && typeof data === "object") {
    return data as TrackProgressMap
  }
  return {}
}

function getCurrentOffset(message: Message) {
    return message.offset + getSeconds(message.time)
}

export function onMessage(
  callback: (message: Message | undefined) => void,
): () => void {
  const handler = (m: Metadata) => {
    const message = extractMessage(m)
    const progress = extractProgress(m)
    if (Object.keys(progress).length > 0) {
      currentProgress = progress
    }

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
    OBR.room.setMetadata({
      [path]: newPlayMessage(fixed, audio.duration, offset),
      [progressPath]: currentProgress,
    })
  }

  audio.src = fixed.url
}

export function pause() {
  logEvent(analytics, "pause")
  if (!currentMessage) {
    throw new ObrError("Unable to pause before receiving first message")
  }

  currentProgress = {
    ...currentProgress,
    [currentMessage.track.url]:
      getCurrentOffset(currentMessage),
  }

  OBR.room.setMetadata({
    [path]: pauseCurrentMessage(),
    [progressPath]: currentProgress,
  })
}

export function resume() {
  logEvent(analytics, "resume")
  OBR.room.setMetadata({
    [path]: resumeCurrentMessage(),
    [progressPath]: currentProgress,
  })
}

export function stop() {
  logEvent(analytics, "stop")
  if (currentMessage) {
    currentProgress = resetTrackProgress(currentProgress, currentMessage.track)
  }

  OBR.room.setMetadata({
    [path]: undefined,
    [progressPath]: currentProgress,
  })
}
