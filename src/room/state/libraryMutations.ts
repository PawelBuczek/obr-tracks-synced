import { Metadata } from "@owlbear-rodeo/sdk"
import { removeTrackProgress, TrackProgressMap } from "../../domain/playback"
import { isSameTrack, Track } from "../../domain/track"
import { updateMetadataWithCurrent } from "../../infra/metadataHelper"
import { cleanTrack } from "../../shared/utils"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  extractProgressMap,
  libraryPath,
  progressPath,
} from "../metadataSchema"
import { buildMergedLibrary, getUpdatedControlTrack } from "./libraryMutationPolicy"

export interface LibraryMutationOutcome {
  changed: boolean
  library: Track[]
  progress: TrackProgressMap
  shouldStopPlayback: boolean
  rejections?: LibraryMergeRejection[]
}

export type LibraryMergeRejectionReason = "url-too-long" | "library-over-limit"

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
    const cleanedTracks = tracks.map(cleanTrack)
    const rejectedTracks = cleanedTracks.filter(
      track => track.url.length > MAX_TRACK_URL_LENGTH,
    )
    const acceptedTracks = cleanedTracks.filter(
      track => track.url.length <= MAX_TRACK_URL_LENGTH,
    )

    let nextLibrary = currentLibrary
    let overLimitCount = 0

    for (const [index, track] of acceptedTracks.entries()) {
      const candidate = buildMergedLibrary(nextLibrary, [track])
      const isAddingNewTrack = candidate.library.length > nextLibrary.length

      if (
        isAddingNewTrack &&
        getLibraryMetadataSizeBytes(candidate.library) >
          LIBRARY_METADATA_SIZE_CAP_BYTES
      ) {
        overLimitCount = acceptedTracks.length - index
        break
      }

      nextLibrary = candidate.library
    }

    const progress = extractProgressMap(current)
    const currentMessage = extractControlMessage(current)
    const nextControl = getUpdatedControlTrack(currentMessage, nextLibrary)

    const libraryChanged =
      JSON.stringify(nextLibrary) !== JSON.stringify(currentLibrary)
    const changed = libraryChanged || nextControl !== undefined

    const rejections: LibraryMergeRejection[] = []
    if (rejectedTracks.length > 0) {
      rejections.push({ reason: "url-too-long", count: rejectedTracks.length })
    }
    if (overLimitCount > 0) {
      rejections.push({ reason: "library-over-limit", count: overLimitCount })
    }

    outcome = {
      changed,
      library: nextLibrary,
      progress,
      shouldStopPlayback: false,
      ...(rejections.length > 0 ? { rejections } : {}),
    }

    if (!changed) {
      return undefined
    }

    return {
      ...(libraryChanged ? { [libraryPath]: nextLibrary } : {}),
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

    const trackIsPlaying =
      currentMessage !== undefined && isSameTrack(currentMessage.track, track)
    const nextProgress = trackIsPlaying
      ? removeTrackProgress(progress, currentMessage.track)
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
    const progress = extractProgressMap(current)

    const sourceIndex = currentLibrary.findIndex(currentTrack =>
      isSameTrack(currentTrack, track),
    )

    if (sourceIndex < 0) {
      outcome = {
        changed: false,
        library: currentLibrary,
        progress,
        shouldStopPlayback: false,
      }
      return undefined
    }

    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1

    if (targetIndex < 0 || targetIndex >= currentLibrary.length) {
      outcome = {
        changed: false,
        library: currentLibrary,
        progress,
        shouldStopPlayback: false,
      }
      return undefined
    }

    const nextLibrary = [...currentLibrary]
    ;[nextLibrary[sourceIndex], nextLibrary[targetIndex]] = [
      nextLibrary[targetIndex],
      nextLibrary[sourceIndex],
    ]

    outcome = {
      changed: true,
      library: nextLibrary,
      progress,
      shouldStopPlayback: false,
    }

    return {
      [libraryPath]: nextLibrary,
    }
  })

  return outcome
}
