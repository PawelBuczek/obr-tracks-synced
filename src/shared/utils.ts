import { Track } from "../domain/track"
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
  let urlObject: URL
  try {
    urlObject = new URL(url)
  } catch {
    throw new ObrError(`Failed to convert, invalid url: ${url}`)
  }

  if (urlObject.hostname.endsWith("dropbox.com")) {
    urlObject.searchParams.set("dl", "1")
    urlObject.hostname = "dl.dropboxusercontent.com"
    return urlObject.href
  }
  return url
}

export interface CheckResult<F, V> {
  fixed: F
  validation?: V
}

export function checkTitle(title: string): CheckResult<string, string> {
  const fixed = title.trim()
  return { fixed, validation: fixed ? undefined : "Title can not be blank" }
}

export function checkUrl(url: string): CheckResult<string, string> {
  const fixed = url.trim()

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

export function checkTags(tags: string[]): CheckResult<string[], string> {
  return { fixed: tags.filter(t => t).map(t => t.trim()) }
}

export interface TrackValidation {
  titleValidation?: string
  urlValidation?: string
  tagsValidation?: string
}

export function checkTrack(
  track: Track,
): CheckResult<Track, TrackValidation | undefined> {
  const { fixed: title, validation: titleValidation } = checkTitle(track.title)
  const { fixed: url, validation: urlValidation } = checkUrl(track.url)
  const { fixed: tags, validation: tagsValidation } = checkTags(track.tags)

  return {
    fixed: { title, url, tags },
    validation:
      titleValidation || urlValidation || tagsValidation
        ? { titleValidation, urlValidation, tagsValidation }
        : undefined,
  }
}
