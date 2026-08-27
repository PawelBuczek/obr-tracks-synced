export type TrackTag = number | string

export interface Track {
  title: string
  url: string
  tags: TrackTag[]
  offset?: number
}

export function canonicalizeTrackUrl(url: string): string {
  const trimmed = url.trim().replace(/\s+/g, "")

  if (!trimmed) {
    return trimmed
  }

  try {
    const fixed = new URL(trimmed)

    if (fixed.hostname.endsWith("dropbox.com") || fixed.hostname === "dl.dropboxusercontent.com") {
      fixed.searchParams.set("dl", "1")
      if (fixed.hostname.endsWith("dropbox.com")) {
        fixed.hostname = "dl.dropboxusercontent.com"
      }
      fixed.hash = ""
      return fixed.toString().toLowerCase()
    }

    fixed.hash = ""
    return fixed.toString().toLowerCase()
  } catch {
    return trimmed
  }
}

export function isSameTrack(left: Track, right: Track): boolean {
  return canonicalizeTrackUrl(left.url) === canonicalizeTrackUrl(right.url)
}

export function toString(track: Track): string {
  return `Title: ${track.title}: Url: ${track.url}`
}

export function emptyTrack(): Track {
  return {
    title: "",
    url: "",
    tags: [],
    offset: 0,
  }
}
