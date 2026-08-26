import { Metadata } from "@owlbear-rodeo/sdk"
import { removeTrackProgress, TrackProgressMap } from "../../domain/playback"
import { isSameTrack, Track } from "../../domain/track"
import { updateMetadataWithCurrent } from "../../infra/metadataHelper"
import { ObrError } from "../../shared/errors"
import { cleanTrack } from "../../shared/utils"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  extractLibraryOrderMap,
  extractProgressMap,
  libraryPath,
  libraryOrderPath,
  progressPath,
  sortLibraryByOrder,
} from "../metadataSchema"
import { buildMergedLibrary, getUpdatedControlTrack } from "./libraryMutationPolicy"

export interface LibraryMutationOutcome {
  changed: boolean
  library: Track[]
  progress: TrackProgressMap
  shouldStopPlayback: boolean
  rejections?: LibraryMergeRejection[]
}

export type LibraryMergeRejectionReason = "url-too-long"

export interface LibraryMergeRejection {
  reason: LibraryMergeRejectionReason
  count: number
}

export type LibraryMoveDirection = "up" | "down"

const LIBRARY_METADATA_SIZE_CAP_BYTES = 6 * 1024
const MAX_TRACK_URL_LENGTH = 200

function getLibraryMetadataSizeBytes(library: Track[]): number {
  return new TextEncoder().encode(JSON.stringify({ [libraryPath]: library })).length
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
    const currentOrderMap = extractLibraryOrderMap(current)
    const cleanedTracks = tracks.map(cleanTrack)
    const rejectedTracks = cleanedTracks.filter(
      track => track.url.length > MAX_TRACK_URL_LENGTH,
    )
    const acceptedTracks = cleanedTracks.filter(
      track => track.url.length <= MAX_TRACK_URL_LENGTH,
    )

    const { library: nextLibrary, orderMap: nextOrderMap } = buildMergedLibrary(
      currentLibrary,
      currentOrderMap,
      acceptedTracks,
    )
    const isAddingNewTrack = nextLibrary.length > currentLibrary.length

    if (
      isAddingNewTrack &&
      getLibraryMetadataSizeBytes(currentLibrary) > LIBRARY_METADATA_SIZE_CAP_BYTES
    ) {
      throw new ObrError("Cannot add track: library metadata is over 6 KB limit")
    }

    const progress = extractProgressMap(current)
    const currentMessage = extractControlMessage(current)
    const nextControl = getUpdatedControlTrack(currentMessage, nextLibrary)

    const libraryChanged =
      JSON.stringify(nextLibrary) !== JSON.stringify(currentLibrary)
    const orderChanged =
      JSON.stringify(nextOrderMap) !== JSON.stringify(currentOrderMap)
    const changed = libraryChanged || orderChanged || nextControl !== undefined

    outcome = {
      changed,
      library: nextLibrary,
      progress,
      shouldStopPlayback: false,
      ...(rejectedTracks.length > 0
        ? {
            rejections: [
              { reason: "url-too-long" as const, count: rejectedTracks.length },
            ],
          }
        : {}),
    }

    if (!changed) {
      return undefined
    }

    return {
      ...(libraryChanged ? { [libraryPath]: nextLibrary } : {}),
      ...(orderChanged ? { [libraryOrderPath]: nextOrderMap } : {}),
      ...(nextControl ? { [controlPath]: nextControl } : {}),
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
    const currentOrderMap = extractLibraryOrderMap(current)
    const progress = extractProgressMap(current)
    const currentMessage = extractControlMessage(current)

    if (!currentLibrary.some(currentTrack => isSameTrack(currentTrack, track))) {
      outcome = {
        changed: false,
        library: currentLibrary,
        progress,
        shouldStopPlayback: false,
      }
      return undefined
    }

    const nextLibrary = currentLibrary.filter(
      currentTrack => !isSameTrack(currentTrack, track),
    )
    const nextOrderMap: Record<string, number> = { ...currentOrderMap }
    currentLibrary
      .filter(currentTrack => isSameTrack(currentTrack, track))
      .forEach(removedTrack => {
        delete nextOrderMap[removedTrack.url]
      })

    const trackIsPlaying =
      currentMessage !== undefined && isSameTrack(currentMessage.track, track)
    const nextProgress = trackIsPlaying
      ? removeTrackProgress(progress, currentMessage.track)
      : progress
    const sortedNextLibrary = sortLibraryByOrder(nextLibrary, nextOrderMap)

    outcome = {
      changed: true,
      library: sortedNextLibrary,
      progress: nextProgress,
      shouldStopPlayback: trackIsPlaying,
    }

    if (trackIsPlaying) {
      return {
        [libraryPath]: sortedNextLibrary,
        [libraryOrderPath]: nextOrderMap,
        [progressPath]: nextProgress,
        [controlPath]: undefined,
      }
    }

    return {
      [libraryPath]: sortedNextLibrary,
      [libraryOrderPath]: nextOrderMap,
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
    const currentOrderMap = extractLibraryOrderMap(current)
    const progress = extractProgressMap(current)
    const currentMessage = extractControlMessage(current)

    const shouldNoop =
      currentLibrary.length === 0 &&
      Object.keys(currentOrderMap).length === 0 &&
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
      [libraryOrderPath]: {},
      [progressPath]: {},
      [controlPath]: undefined,
    }
  })

  return outcome
}

export async function moveTrackInRoomLibrary(
  track: Track,
  direction: LibraryMoveDirection,
): Promise<LibraryMutationOutcome> {
  let outcome: LibraryMutationOutcome = {
    changed: false,
    library: [],
    progress: {},
    shouldStopPlayback: false,
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentLibrary = extractLibrary(current)
    const currentOrderMap = extractLibraryOrderMap(current)
    const progress = extractProgressMap(current)

    const sortedLibrary = sortLibraryByOrder(currentLibrary, currentOrderMap)
    const sourceIndex = sortedLibrary.findIndex(currentTrack =>
      isSameTrack(currentTrack, track),
    )

    if (sourceIndex < 0) {
      outcome = {
        changed: false,
        library: sortedLibrary,
        progress,
        shouldStopPlayback: false,
      }
      return undefined
    }

    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1

    if (targetIndex < 0 || targetIndex >= sortedLibrary.length) {
      outcome = {
        changed: false,
        library: sortedLibrary,
        progress,
        shouldStopPlayback: false,
      }
      return undefined
    }

    const sourceTrack = sortedLibrary[sourceIndex]
    const targetTrack = sortedLibrary[targetIndex]
    const sourceOrder = currentOrderMap[sourceTrack.url] ?? sourceIndex
    const targetOrder = currentOrderMap[targetTrack.url] ?? targetIndex

    const nextOrderMap: Record<string, number> = {
      ...currentOrderMap,
      [sourceTrack.url]: targetOrder,
      [targetTrack.url]: sourceOrder,
    }
    const nextLibrary = sortLibraryByOrder(currentLibrary, nextOrderMap)

    outcome = {
      changed: true,
      library: nextLibrary,
      progress,
      shouldStopPlayback: false,
    }

    return {
      [libraryPath]: nextLibrary,
      [libraryOrderPath]: nextOrderMap,
    }
  })

  return outcome
}
