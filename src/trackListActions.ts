import { Action } from "./playback"
import { Track } from "./track"

function getComparableTrackUrl(track: Track): string {
  try {
    const url = new URL(track.url)
    if (url.hostname.endsWith("dropbox.com")) {
      url.searchParams.set("dl", "1")
      url.hostname = "dl.dropboxusercontent.com"
      return url.toString()
    }
    return track.url
  } catch {
    return track.url
  }
}

export function getTrackListClickAction(
  clickedTrack: Track,
  currentMessage: { track: Track; action: Action } | undefined,
): "play" | "pause" | "resume" {
  if (
    currentMessage &&
    getComparableTrackUrl(currentMessage.track) ===
      getComparableTrackUrl(clickedTrack)
  ) {
    return currentMessage.action === Action.Pause ? "resume" : "pause"
  }

  return "play"
}
