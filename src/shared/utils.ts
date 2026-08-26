import { resolveTagId } from "../domain/tags"
import { canonicalizeTrackUrl, Track } from "../domain/track"
import { now } from "../infra/time"
import { ObrError } from "./errors"

// get number of seconds between two times
export function getSeconds(time: Date) {
  return (now().getTime() - new Date(time).getTime()) / 1000
}

export function getPlaybackTime(
  offsetSeconds: number,
  elapsedSeconds: number,
  durationSeconds: number,
) {
  const rawTime = offsetSeconds + elapsedSeconds

  if (!Number.isFinite(rawTime)) {
    return 0
  }

  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    const wrappedTime = rawTime % durationSeconds
    return wrappedTime >= 0 ? wrappedTime : wrappedTime + durationSeconds
  }

  return Math.max(0, rawTime)
}

// convert urls into direct downloadable urls, currently only supports dropbox
export function convertToDirectDownloadable(url: string): string {
  try {
    return canonicalizeTrackUrl(url)
  } catch {
    throw new ObrError(`Failed to convert, invalid url: ${url}`)
  }
}

export interface CheckResult<F, V> {
  fixed: F
  validation?: V
}

export function normalizeTrackTags(tags: Array<number | string>): Array<number | string> {
  return tags
    .map(tag => {
      if (typeof tag === "number") {
        return Number.isInteger(tag) && tag >= 0 ? tag : undefined
      }

      const normalized = tag.trim()
      if (!normalized) {
        return undefined
      }

      return resolveTagId(normalized) ?? normalized.toLowerCase()
    })
    .filter((tag): tag is number | string => tag !== undefined && tag !== "")
}

export function normalizeTrackOffset(offset: number | string | undefined): number {
  const value = typeof offset === "number" ? offset : Number(offset ?? 0)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export function cleanTrack(track: Track): Track {
  return {
    ...track,
    title: track.title.trim(),
    url: canonicalizeTrackUrl(track.url),
    tags: normalizeTrackTags(track.tags),
    offset: normalizeTrackOffset(track.offset),
  }
}

export function checkTitle(title: string): CheckResult<string, string> {
  const fixed = title.trim()
  return { fixed, validation: fixed ? undefined : "Title can not be blank" }
}

export function checkUrl(url: string): CheckResult<string, string> {
  const fixed = canonicalizeTrackUrl(url)

  try {
    const urlObject = new URL(fixed)
    if (urlObject.hostname === "drive.google.com") {
      return {
        fixed,
        validation: "Google Drive urls no longer work",
      }
    }
  } catch {
    return { fixed, validation: "Invalid url" }
  }

  return { fixed }
}

export function checkTags(tags: Array<number | string>): CheckResult<Array<number | string>, string> {
  return { fixed: normalizeTrackTags(tags) }
}

export interface TrackValidation {
  titleValidation?: string
  urlValidation?: string
  tagsValidation?: string
  offsetValidation?: string
}

export function checkTrack(
  track: Track,
): CheckResult<Track, TrackValidation | undefined> {
  const fixed = cleanTrack(track)
  const { validation: titleValidation } = checkTitle(fixed.title)
  const { validation: urlValidation } = checkUrl(fixed.url)
  const { validation: tagsValidation } = checkTags(fixed.tags)
  const offsetValidation =
    Number.isFinite(fixed.offset ?? 0) && (fixed.offset ?? 0) >= 0
      ? undefined
      : "Offset must be a finite non-negative number"

  return {
    fixed,
    validation:
      titleValidation || urlValidation || tagsValidation || offsetValidation
        ? { titleValidation, urlValidation, tagsValidation, offsetValidation }
        : undefined,
  }
}
