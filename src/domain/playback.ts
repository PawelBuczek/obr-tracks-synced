import { isSameTrack, Track } from "./track"

export enum Action {
  Play,
  Pause,
}

export function getPlaybackOffset(
  offset: number,
  time: Date,
  referenceTime: Date = new Date(),
): number {
  return offset + (referenceTime.getTime() - time.getTime()) / 1000
}

export function getTrackInteractionAction(
  clickedTrack: Track,
  activeTrack: Track | undefined,
  activeAction: Action | undefined,
): "play" | "pause" | "resume" {
  if (activeTrack && isSameTrack(activeTrack, clickedTrack)) {
    return activeAction === Action.Pause ? "resume" : "pause"
  }

  return "play"
}
