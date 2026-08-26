import { TrackProgressMap } from "../../domain/playback"
import { Track } from "../../domain/track"
import { updateMetadata } from "../../infra/metadataHelper"
import {
  libraryPath,
  progressPath,
  controlPath,
} from "../metadataSchema"

export async function writeLibrary(library: Track[]) {
  return updateMetadata({
    [libraryPath]: library,
    [progressPath]: undefined,
  })
}

export function writeLibraryAndProgress(
  library: Track[],
  _progress: TrackProgressMap,
) {
  return updateMetadata({
    [libraryPath]: library,
    [progressPath]: undefined,
  })
}

export function writeLibraryAndProgressAndClearControl(
  library: Track[],
  _progress: TrackProgressMap,
) {
  return updateMetadata({
    [libraryPath]: library,
    [controlPath]: undefined,
    [progressPath]: undefined,
  })
}

