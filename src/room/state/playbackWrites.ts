import { isSameTrack, Track } from "../../domain/track"
import { updateMetadataWithCurrent } from "../../infra/metadataHelper"
import {
  controlPath,
  encodeLibrary,
  extractControlMessage,
  extractLibrary,
  libraryPath,
  progressPath,
  RoomControlMessage,
} from "../metadataSchema"

function withTrackOffset(library: Track[], track: Track, offset: number): Track[] {
  return library.map(currentTrack =>
    isSameTrack(currentTrack, track)
      ? {
          ...currentTrack,
          offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
        }
      : currentTrack,
  )
}

export function writeControlAndProgress(
  control: RoomControlMessage,
  options?: {
    expectedControlId?: string
    saveTrack?: Track
    saveOffset?: number
  }
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

    let nextLibrary = withTrackOffset(currentLibrary, control.track, control.offset)
    if (options?.saveTrack && options.saveOffset !== undefined) {
      nextLibrary = withTrackOffset(nextLibrary, options.saveTrack, options.saveOffset)
    }

    return {
      [libraryPath]: encodeLibrary(nextLibrary),
      [controlPath]: control,
      [progressPath]: undefined,
    }
  })
}

export function clearControlAndWriteProgress(track?: Track) {
  return updateMetadataWithCurrent(current => {
    const currentLibrary = extractLibrary(current)
    const nextLibrary = track
      ? withTrackOffset(currentLibrary, track, 0)
      : currentLibrary

    return {
      ...(nextLibrary !== currentLibrary ? { [libraryPath]: encodeLibrary(nextLibrary) } : {}),
      [controlPath]: undefined,
      [progressPath]: undefined,
    }
  })
}
