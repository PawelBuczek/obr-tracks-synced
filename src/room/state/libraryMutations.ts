import { Metadata } from "@owlbear-rodeo/sdk"
import { isSameTrack, Track } from "../../domain/track"
import { updateMetadataWithCurrent } from "../../infra/metadataHelper"
import { cleanTrack } from "../../shared/utils"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  libraryPath,
  progressPath,
} from "../metadataSchema"
import { buildMergedLibrary, getUpdatedControlTrack } from "./libraryMutationPolicy"

export interface LibraryMutationOutcome {
  changed: boolean
  library: Track[]
  shouldStopPlayback: boolean
  rejections?: LibraryMergeRejection[]
}

export type LibraryMergeRejectionReason =
  | "url-too-long"
  | "library-over-limit"
  | "library-track-limit"

export interface LibraryMergeRejection {
  reason: LibraryMergeRejectionReason
  count: number
}

export type LibraryMoveDirection = "up" | "down"

const LIBRARY_METADATA_SIZE_CAP_BYTES = 6 * 1024
const MAX_LIBRARY_TRACKS = 200
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
    let trackLimitCount = 0

    for (const [index, track] of acceptedTracks.entries()) {
      const candidate = buildMergedLibrary(nextLibrary, [track])
      const isAddingNewTrack = candidate.library.length > nextLibrary.length

      if (isAddingNewTrack && candidate.library.length > MAX_LIBRARY_TRACKS) {
        trackLimitCount++
        continue
      }

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
    if (trackLimitCount > 0) {
      rejections.push({ reason: "library-track-limit", count: trackLimitCount })
    }

    outcome = {
      changed,
      library: nextLibrary,
      shouldStopPlayback: false,
      ...(rejections.length > 0 ? { rejections } : {}),
    }

    if (!changed) {
      return undefined
    }

    return {
      ...(libraryChanged ? { [libraryPath]: nextLibrary } : {}),
      ...(nextControl ? { [controlPath]: nextControl } : {}),
      [progressPath]: undefined,
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
    shouldStopPlayback: false,
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentLibrary = extractLibrary(current)
    const currentMessage = extractControlMessage(current)

    if (!currentLibrary.some(currentTrack => isSameTrack(currentTrack, track))) {
      outcome = {
        changed: false,
        library: currentLibrary,
        shouldStopPlayback: false,
      }
      return undefined
    }

    const nextLibrary = currentLibrary.filter(
      currentTrack => !isSameTrack(currentTrack, track),
    )

    const trackIsPlaying =
      currentMessage !== undefined && isSameTrack(currentMessage.track, track)
    outcome = {
      changed: true,
      library: nextLibrary,
      shouldStopPlayback: trackIsPlaying,
    }

    if (trackIsPlaying) {
      return {
        [libraryPath]: nextLibrary,
        [controlPath]: undefined,
        [progressPath]: undefined,
      }
    }

    return {
      [libraryPath]: nextLibrary,
      [progressPath]: undefined,
    }
  })

  return outcome
}

export async function clearRoomLibrary(): Promise<LibraryMutationOutcome> {
  let outcome: LibraryMutationOutcome = {
    changed: false,
    library: [],
    shouldStopPlayback: false,
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentLibrary = extractLibrary(current)
    const currentMessage = extractControlMessage(current)

    const shouldNoop =
      currentLibrary.length === 0 &&
      currentMessage === undefined

    if (shouldNoop) {
      outcome = {
        changed: false,
        library: [],
        shouldStopPlayback: false,
      }
      return undefined
    }

    outcome = {
      changed: true,
      library: [],
      shouldStopPlayback: true,
    }

    return {
      [libraryPath]: [],
      [controlPath]: undefined,
      [progressPath]: undefined,
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
    shouldStopPlayback: false,
  }

  await updateMetadataWithCurrent((current: Metadata) => {
    const currentLibrary = extractLibrary(current)
    const sourceIndex = currentLibrary.findIndex(currentTrack =>
      isSameTrack(currentTrack, track),
    )

    if (sourceIndex < 0) {
      outcome = {
        changed: false,
        library: currentLibrary,
        shouldStopPlayback: false,
      }
      return undefined
    }

    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1

    if (targetIndex < 0 || targetIndex >= currentLibrary.length) {
      outcome = {
        changed: false,
        library: currentLibrary,
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
      shouldStopPlayback: false,
    }

    return {
      [libraryPath]: nextLibrary,
      [progressPath]: undefined,
    }
  })

  return outcome
}
