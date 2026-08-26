import { ObrError } from "../../shared/errors"
import { checkTrack } from "../../shared/utils"
import { isSameTrack, Track } from "../../domain/track"
import { RoomControlMessage } from "../metadataSchema"

function sameTags(left: Array<number | string>, right: Array<number | string>): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((tag, index) => String(tag) === String(right[index]))
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

export function buildMergedLibrary(
  currentLibrary: Track[],
  tracks: Track[],
): {
  library: Track[]
} {
  const updatedLibrary = currentLibrary.map(track => ({
    ...track,
  }))

  tracks.forEach(track => {
    const { fixed, validation } = checkTrack(track)

    if (validation) {
      throw new ObrError("Track validation failed", fixed, validation)
    }

    const existingIndex = updatedLibrary.findIndex(currentTrack =>
      isSameTrack(currentTrack, fixed),
    )

    const hasDuplicateTitle = updatedLibrary.some(
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
        url: fixed.url,
        tags: fixed.tags,
        offset: updatedLibrary[existingIndex].offset ?? 0,
      }
    } else {
      updatedLibrary.push(fixed)
    }
  })

  return {
    library: updatedLibrary,
  }
}
