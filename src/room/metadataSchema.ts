import { Metadata } from "@owlbear-rodeo/sdk"
import { Action, TrackProgressMap } from "../domain/playback"
import { Track } from "../domain/track"
import { key } from "../shared/key"

export const controlPath = key("control")
export const progressPath = key("progress")
export const libraryPath = key("library")

export interface RoomControlMessage {
  id: string
  time: Date
  action: Action
  offset: number
  duration: number
  track: Track
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function parseTrack(value: unknown): Track | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const title = value.title
  const url = value.url
  const tags = value.tags

  if (typeof title !== "string" || typeof url !== "string" || !Array.isArray(tags)) {
    return undefined
  }

  if (!tags.every(tag => typeof tag === "string")) {
    return undefined
  }

  const fixed = {
    title: title.trim(),
    url: url.trim(),
    tags: tags.map(tag => tag.trim()).filter(tag => tag),
  }

  if (!fixed.title || !fixed.url) {
    return undefined
  }

  return fixed
}

export function extractLibrary(metadata: Metadata): Track[] {
  const value = metadata[libraryPath]

  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(track => parseTrack(track))
    .filter((track): track is Track => track !== undefined)
}

export function extractProgressMap(metadata: Metadata): TrackProgressMap {
  const value = metadata[progressPath]

  if (!isRecord(value)) {
    return {}
  }

  const progress: TrackProgressMap = {}

  Object.entries(value).forEach(([trackUrl, offset]) => {
    if (isFiniteNumber(offset) && offset >= 0) {
      progress[trackUrl] = offset
    }
  })

  return progress
}

export function extractControlMessage(
  metadata: Metadata,
): RoomControlMessage | undefined {
  const value = metadata[controlPath]

  if (!isRecord(value)) {
    return undefined
  }

  const id = value.id
  const timeValue = value.time
  const action = value.action
  const offset = value.offset
  const duration = value.duration
  const track = parseTrack(value.track)

  if (
    typeof id !== "string" ||
    (action !== Action.Play && action !== Action.Pause) ||
    !isFiniteNumber(offset) ||
    !isFiniteNumber(duration) ||
    track === undefined
  ) {
    return undefined
  }

  if (
    typeof timeValue !== "string" &&
    typeof timeValue !== "number" &&
    !(timeValue instanceof Date)
  ) {
    return undefined
  }

  const time = new Date(timeValue)
  if (isNaN(time.getTime())) {
    return undefined
  }

  return {
    id,
    time,
    action,
    offset,
    duration,
    track,
  }
}
