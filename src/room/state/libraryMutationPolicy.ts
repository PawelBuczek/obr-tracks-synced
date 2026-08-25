import { ObrError } from "../../shared/errors"
import { checkTrack } from "../../shared/utils"
import { isSameTrack, Track } from "../../domain/track"
import { RoomControlMessage, sortLibraryByOrder } from "../metadataSchema"

function sameTags(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((tag, index) => tag === right[index])
}

export function getUpdatedControlTrack(
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

export function buildMergedLibrary(
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
