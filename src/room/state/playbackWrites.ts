import { TrackProgressMap } from "../../domain/playback"
import { isSameTrack, Track } from "../../domain/track"
import { updateMetadataWithCurrent } from "../../infra/metadataHelper"
import {
  controlPath,
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
  _progress: TrackProgressMap,
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

    const nextLibrary = withTrackOffset(currentLibrary, control.track, control.offset)

    return {
      [libraryPath]: nextLibrary,
      [controlPath]: control,
      [progressPath]: undefined,
    }
  })
}

export function clearControlAndWriteProgress(
  _progress: TrackProgressMap,
  track?: Track,
) {
  return updateMetadataWithCurrent(current => {
    const currentLibrary = extractLibrary(current)
    const nextLibrary = track
      ? withTrackOffset(currentLibrary, track, 0)
      : currentLibrary

    return {
      ...(nextLibrary !== currentLibrary ? { [libraryPath]: nextLibrary } : {}),
      [controlPath]: undefined,
      [progressPath]: undefined,
    }
  })
}
