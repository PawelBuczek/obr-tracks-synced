import { Metadata } from "@owlbear-rodeo/sdk"
import { TrackProgressMap } from "../../domain/playback"
import { Track } from "../../domain/track"
import { getMetadataSize, updateMetadata, updateMetadataWithCurrent } from "../../infra/metadataHelper"
import {
  libraryPath,
  LibrarySortMode,
  librarySortModePath,
  extractLibrarySortMode,
  progressPath,
  controlPath,
} from "../metadataSchema"

export async function writeLibrary(library: Track[]) {
  const metadataSizeBeforeWrite = await getMetadataSize()
  console.log("metadataSizeBeforeWriteLibrarty", metadataSizeBeforeWrite)

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

export async function writeLibrarySortMode(
  mode: LibrarySortMode,
): Promise<boolean> {
  let changed = false

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentMode = extractLibrarySortMode(current)

    if (currentMode === mode) {
      changed = false
      return undefined
    }

    changed = true

    return {
      [librarySortModePath]: mode,
    }
  })

  return changed
}
