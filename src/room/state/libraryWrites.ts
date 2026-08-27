import { Track } from "../../domain/track"
import { updateMetadata } from "../../infra/metadataHelper"
import {
  encodeLibrary,
  libraryPath,
  progressPath,
  controlPath,
} from "../metadataSchema"

export async function writeLibrary(library: Track[]) {
  return updateMetadata({
    [libraryPath]: encodeLibrary(library),
    [progressPath]: undefined,
  })
}

export function writeLibraryAndProgress(library: Track[]) {
  return updateMetadata({
    [libraryPath]: encodeLibrary(library),
    [progressPath]: undefined,
  })
}

export function writeLibraryAndProgressAndClearControl(library: Track[]) {
  return updateMetadata({
    [libraryPath]: encodeLibrary(library),
    [controlPath]: undefined,
    [progressPath]: undefined,
  })
}

