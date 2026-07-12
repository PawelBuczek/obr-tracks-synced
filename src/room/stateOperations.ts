import { Metadata } from "@owlbear-rodeo/sdk"
import { removeTrackProgress, TrackProgressMap } from "../domain/playback"
import { isSameTrack, Track } from "../domain/track"
import { updateMetadata, updateMetadataWithCurrent } from "../infra/metadataHelper"
import { ObrError } from "../shared/errors"
import { checkTrack } from "../shared/utils"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  extractLibraryOrderMap,
  extractLibrarySortMode,
  extractProgressMap,
  libraryPath,
  libraryOrderPath,
  LibrarySortMode,
  librarySortModePath,
  progressPath,
  sortLibraryByOrder,
  RoomControlMessage,
} from "./metadataSchema"

export function writeControlAndProgress(
  control: RoomControlMessage,
  progress: TrackProgressMap,
  options?: {
    expectedControlId?: string
  },
) {
  return updateMetadataWithCurrent(current => {
    const currentLibrary = extractLibrary(current)

    const trackStillInLibrary = currentLibrary.some(track =>
      isSameTrack(track, control.track),
    )

    if (!trackStillInLibrary) {
      return undefined
    }

    if (options?.expectedControlId !== undefined) {
      const currentMessage = extractControlMessage(current)

      if (currentMessage?.id !== options.expectedControlId) {
        return undefined
      }
    }

    return {
      [controlPath]: control,
      [progressPath]: progress,
    }
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

export type LibraryMoveDirection = "up" | "down"

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

function sameTags(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((tag, index) => tag === right[index])
}

function getUpdatedControlTrack(
  currentMessage: RoomControlMessage | undefined,
  library: Track[],
): RoomControlMessage | undefined {
  if (!currentMessage) {
    return undefined
  }

  const matchingTrack = library.find(track =>
    isSameTrack(track, currentMessage.track),
  )

  if (!matchingTrack) {
    return undefined
  }

  const shouldRefreshTrackDetails =
    currentMessage.track.title !== matchingTrack.title ||
    !sameTags(currentMessage.track.tags, matchingTrack.tags)

  if (!shouldRefreshTrackDetails) {
    return undefined
  }

  return {
    ...currentMessage,
    track: {
      ...currentMessage.track,
      title: matchingTrack.title,
      tags: [...matchingTrack.tags],
    },
  }
}

function getNextLibraryOrder(orderMap: Record<string, number>): number {
  const values = Object.values(orderMap)

  if (values.length === 0) {
    return 0
  }

  return Math.max(...values) + 1
}

function buildMergedLibrary(
  currentLibrary: Track[],
  currentOrderMap: Record<string, number>,
  tracks: Track[],
): {
  library: Track[]
  orderMap: Record<string, number>
} {
  const updatedLibrary = currentLibrary.map(track => ({
    ...track,
  }))
  const allTracks: Track[] = [...updatedLibrary]
  const nextOrderMap: Record<string, number> = { ...currentOrderMap }
  let nextOrder = getNextLibraryOrder(nextOrderMap)

  tracks.forEach(track => {
    const { fixed, validation } = checkTrack(track)

    if (validation) {
      throw new ObrError("Track validation failed", fixed, validation)
    }

    const existingIndex = updatedLibrary.findIndex(currentTrack =>
      isSameTrack(currentTrack, fixed),
    )

    const hasDuplicateTitle = allTracks.some(
      currentTrack =>
        currentTrack.title === fixed.title &&
        !isSameTrack(currentTrack, fixed),
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
      nextOrderMap[fixed.url] = nextOrder
      nextOrder += 1
      updatedLibrary.push(fixed)
      allTracks.push(fixed)
    }
  })

  return {
    library: sortLibraryByOrder(updatedLibrary, nextOrderMap),
    orderMap: nextOrderMap,
  }
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
    const { library: nextLibrary, orderMap: nextOrderMap } = buildMergedLibrary(
      currentLibrary,
      currentOrderMap,
      tracks,
    )
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
