import { Action } from "./playback"
import { Track, isSameTrack } from "./track"

export function getTrackListClickAction(
  clickedTrack: Track,
  currentMessage: { track: Track; action: Action } | undefined,
): "play" | "pause" | "resume" {
  if (currentMessage && isSameTrack(currentMessage.track, clickedTrack)) {
    return currentMessage.action === Action.Pause ? "resume" : "pause"
  }

  return "play"
}
