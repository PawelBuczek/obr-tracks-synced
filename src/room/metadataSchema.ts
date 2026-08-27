import { Metadata } from "@owlbear-rodeo/sdk"
import { deflateSync, inflateSync, strFromU8, strToU8 } from "fflate"
import { Action } from "../domain/playback"
import {
  CUSTOM_TAG_ID_MAX,
  CUSTOM_TAG_ID_MIN,
  CustomTagMap,
  isValidTagId,
  MAX_CUSTOM_TAG_NAME_LENGTH,
} from "../domain/tags"
import { canonicalizeTrackUrl, Track } from "../domain/track"
import { key } from "../shared/key"

export const controlPath = key("control")
export const progressPath = key("progress")
export const libraryPath = key("library")
export const customTagsPath = key("customTags")

const MIN_TAG_ID = 0
const MAX_TAG_ID = 99
const MAX_TAGS_PER_TRACK = 5

export interface RoomControlMessage {
  id: string
  time: Date
  action: Action
  offset: number
  duration: number
  track: Omit<Track, "offset">
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

export function extractCustomTags(metadata: Metadata): CustomTagMap {
  const value = metadata[customTagsPath]
  if (!isRecord(value)) {
    return {}
  }

  const customTags: CustomTagMap = {}
  Object.entries(value).forEach(([rawId, rawName]) => {
    const id = Number(rawId)
    const name = typeof rawName === "string" ? rawName.trim() : ""
    if (
      Number.isInteger(id) &&
      id >= CUSTOM_TAG_ID_MIN &&
      id <= CUSTOM_TAG_ID_MAX &&
      name.length > 0 &&
      name.length <= MAX_CUSTOM_TAG_NAME_LENGTH
    ) {
      customTags[String(id)] = name
    }
  })
  return customTags
}

function parseTrack(value: unknown): Track | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const title = value.title
  const url = value.url
  const tags = value.tags
  const offsetValue = value.offset ?? 0

  if (typeof title !== "string" || typeof url !== "string" || !Array.isArray(tags)) {
    return undefined
  }

  const tagIds = tags
    .map(tag => {
      if (typeof tag === "number") {
        return isValidTagId(tag) && tag >= MIN_TAG_ID && tag <= MAX_TAG_ID
          ? tag
          : undefined
      }
      return typeof tag === "string" && tag.trim() ? tag.trim() : undefined
    })
    .filter((tag): tag is number | string => tag !== undefined)

  if (tagIds.length !== tags.length || tagIds.length > MAX_TAGS_PER_TRACK) {
    return undefined
  }

  if (new Set(tagIds).size !== tagIds.length) {
    return undefined
  }

  const offset = Number(offsetValue)

  if (!Number.isFinite(offset) || offset < 0) {
    return undefined
  }

  const fixed = {
    title: title.trim(),
    url: canonicalizeTrackUrl(url.trim()),
    tags: tagIds,
    offset,
  }

  if (!fixed.title || !fixed.url) {
    return undefined
  }

  return fixed
}

// btoa/String.fromCharCode only accept a bounded number of arguments, so
// convert bytes to a binary string in chunks to avoid call-stack limits.
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000
  let binary = ""
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0))
}

// Library entries share a lot of repeated substrings (hostnames, share-link
// path segments, query param names), so store the whole array as one
// deflate-compressed, base64-encoded string instead of raw JSON to fit more
// tracks under the room metadata size cap.
export function encodeLibrary(library: Track[]): string {
  const compressed = deflateSync(strToU8(JSON.stringify(library)), { level: 9 })
  return bytesToBase64(compressed)
}

function decodeLibraryEntries(value: unknown): unknown[] {
  if (typeof value !== "string") {
    return []
  }

  try {
    const compressed = base64ToBytes(value)
    const decompressed = strFromU8(inflateSync(compressed))
    if (!decompressed) {
      return []
    }

    const parsed = JSON.parse(decompressed)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function extractLibrary(metadata: Metadata): Track[] {
  const value = metadata[libraryPath]

  return decodeLibraryEntries(value)
    .map(track => parseTrack(track))
    .filter((track): track is Track => track !== undefined)
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
  const parsedTrack = parseTrack(value.track)

  if (
    typeof id !== "string" ||
    (action !== Action.Play && action !== Action.Pause) ||
    !isFiniteNumber(offset) ||
    !isFiniteNumber(duration) ||
    parsedTrack === undefined
  ) {
    return undefined
  }

  const { offset: _ignoredOffset, ...track } = parsedTrack

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
