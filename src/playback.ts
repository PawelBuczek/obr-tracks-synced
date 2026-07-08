import { Track } from "./track"

export enum Action {
  Play,
  Pause,
}

export interface TrackProgressMap {
  [trackUrl: string]: number
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
  progressMap: TrackProgressMap,
  track: Track,
): TrackProgressMap {
  return {
    ...progressMap,
    [track.url]: 0,
  }
}
