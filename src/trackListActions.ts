import { Action } from "./playback"
import { Track } from "./track"

export function getTrackListClickAction(
  clickedTrack: Track,
  currentMessage: { track: Track; action: Action } | undefined,
): "play" | "pause" | "resume" {
  if (currentMessage?.track.url === clickedTrack.url) {
    return currentMessage.action === Action.Pause ? "resume" : "pause"
  }

  return "play"
}
