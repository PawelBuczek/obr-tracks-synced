import { isSameTrack, Track } from "./track"

export enum Action {
  Play,
  Pause,
}

export interface TrackProgressMap {
  [trackUrl: string]: number
}

export function getPlaybackOffset(
  offset: number,
  time: Date,
  referenceTime: Date = new Date(),
): number {
  return offset + (referenceTime.getTime() - time.getTime()) / 1000
}

export function prepareTrackSelection(
  track: Track,
  progressMap: TrackProgressMap,
  currentTrack?: Track,
  currentOffset?: number,
  currentAction?: Action,
): { progressMap: TrackProgressMap; offset: number } {
  const shouldSaveCurrentTrackProgress =
    currentTrack !== undefined &&
    currentOffset !== undefined &&
    currentAction === Action.Play &&
    currentTrack.url !== track.url

  const nextProgressMap = shouldSaveCurrentTrackProgress
    ? { ...progressMap, [currentTrack.url]: currentOffset }
    : progressMap

  return {
    progressMap: nextProgressMap,
    offset: nextProgressMap[track.url] ?? 0,
  }
}

export function resetTrackProgress(
  progressMap: TrackProgressMap | undefined,
  track: Track,
): TrackProgressMap {
  return {
    ...progressMap,
    [track.url]: 0,
  }
}

export function removeTrackProgress(
  progressMap: TrackProgressMap,
  track: Track,
): TrackProgressMap {
  const nextProgressMap = { ...progressMap }
  delete nextProgressMap[track.url]
  return nextProgressMap
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
