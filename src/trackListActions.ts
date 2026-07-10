import { Action } from "./playback"
import { Track } from "./track"
import { convertToDirectDownloadable } from "./utils"

function getComparableTrackUrl(track: Track): string {
  try {
    return convertToDirectDownloadable(track.url)
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
