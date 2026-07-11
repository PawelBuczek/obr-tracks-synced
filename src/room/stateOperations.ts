import { Metadata } from "@owlbear-rodeo/sdk"
import { removeTrackProgress, TrackProgressMap } from "../domain/playback"
import { Track } from "../domain/track"
import { updateMetadata, updateMetadataWithCurrent } from "../infra/metadataHelper"
import { ObrError } from "../shared/errors"
import { checkTrack } from "../shared/utils"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  extractProgressMap,
  libraryPath,
  progressPath,
  RoomControlMessage,
} from "./metadataSchema"

export function writeControlAndProgress(
  control: RoomControlMessage,
  progress: TrackProgressMap,
) {
  return updateMetadata({
    [controlPath]: control,
    [progressPath]: progress,
  })
}

export function clearControlAndWriteProgress(progress: TrackProgressMap) {
  return updateMetadata({
    [controlPath]: undefined,
    [progressPath]: progress,
  })
}

export function writeLibrary(library: Track[]) {
  return updateMetadata({
    [libraryPath]: library,
  })
}

export function writeLibraryAndProgress(
  library: Track[],
  progress: TrackProgressMap,
) {
  return updateMetadata({
    [libraryPath]: library,
    [progressPath]: progress,
  })
}

export function writeLibraryAndProgressAndClearControl(
  library: Track[],
  progress: TrackProgressMap,
) {
  return updateMetadata({
    [libraryPath]: library,
    [progressPath]: progress,
    [controlPath]: undefined,
  })
}

export interface LibraryMutationOutcome {
  changed: boolean
  library: Track[]
  progress: TrackProgressMap
  shouldStopPlayback: boolean
}

function buildMergedLibrary(currentLibrary: Track[], tracks: Track[]): Track[] {
  const updatedLibrary = currentLibrary.map(track => ({
    ...track,
  }))
  const newTracks: Track[] = []
  const allTracks: Track[] = [...updatedLibrary]

  tracks.forEach(track => {
    const { fixed, validation } = checkTrack(track)

    if (validation) {
      throw new ObrError("Track validation failed", fixed, validation)
    }

    const existingIndex = updatedLibrary.findIndex(
      currentTrack => currentTrack.url === fixed.url,
    )

    const hasDuplicateTitle = allTracks.some(
      currentTrack =>
        currentTrack.title === fixed.title &&
        currentTrack.url !== fixed.url,
    )

    if (hasDuplicateTitle) {
      throw new ObrError("Track validation failed", fixed, {
        titleValidation: "Title already exists",
      })
    }

    if (existingIndex >= 0) {
      updatedLibrary[existingIndex] = {
        ...updatedLibrary[existingIndex],
        title: fixed.title,
        tags: fixed.tags,
      }
    } else {
      newTracks.push(fixed)
      allTracks.push(fixed)
    }
  })

  return [...newTracks, ...updatedLibrary]
}

export async function mergeTracksIntoRoomLibrary(
  tracks: Track[],
): Promise<LibraryMutationOutcome> {
  let outcome: LibraryMutationOutcome = {
    changed: false,
    library: [],
    progress: {},
    shouldStopPlayback: false,
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentLibrary = extractLibrary(current)
    const nextLibrary = buildMergedLibrary(currentLibrary, tracks)
    const progress = extractProgressMap(current)

    const changed = JSON.stringify(nextLibrary) !== JSON.stringify(currentLibrary)

    outcome = {
      changed,
      library: nextLibrary,
      progress,
      shouldStopPlayback: false,
    }

    if (!changed) {
      return undefined
    }

    return {
      [libraryPath]: nextLibrary,
    }
  })

  return outcome
}

export async function deleteTrackFromRoomLibrary(
  track: Track,
): Promise<LibraryMutationOutcome> {
  let outcome: LibraryMutationOutcome = {
    changed: false,
    library: [],
    progress: {},
    shouldStopPlayback: false,
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentLibrary = extractLibrary(current)
    const progress = extractProgressMap(current)
    const currentMessage = extractControlMessage(current)

    if (!currentLibrary.some(currentTrack => currentTrack.url === track.url)) {
      outcome = {
        changed: false,
        library: currentLibrary,
        progress,
        shouldStopPlayback: false,
      }
      return undefined
    }

    const nextLibrary = currentLibrary.filter(currentTrack => currentTrack.url !== track.url)
    const trackIsPlaying = currentMessage?.track.url === track.url
    const nextProgress = trackIsPlaying
      ? removeTrackProgress(progress, track)
      : progress

    outcome = {
      changed: true,
      library: nextLibrary,
      progress: nextProgress,
      shouldStopPlayback: trackIsPlaying,
    }

    if (trackIsPlaying) {
      return {
        [libraryPath]: nextLibrary,
        [progressPath]: nextProgress,
        [controlPath]: undefined,
      }
    }

    return {
      [libraryPath]: nextLibrary,
    }
  })

  return outcome
}

export async function clearRoomLibrary(): Promise<LibraryMutationOutcome> {
  let outcome: LibraryMutationOutcome = {
    changed: false,
    library: [],
    progress: {},
    shouldStopPlayback: false,
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentLibrary = extractLibrary(current)
    const progress = extractProgressMap(current)
    const currentMessage = extractControlMessage(current)

    const shouldNoop =
      currentLibrary.length === 0 &&
      Object.keys(progress).length === 0 &&
      currentMessage === undefined

    if (shouldNoop) {
      outcome = {
        changed: false,
        library: [],
        progress: {},
        shouldStopPlayback: false,
      }
      return undefined
    }

    outcome = {
      changed: true,
      library: [],
      progress: {},
      shouldStopPlayback: true,
    }

    return {
      [libraryPath]: [],
      [progressPath]: {},
      [controlPath]: undefined,
    }
  })

  return outcome
}
