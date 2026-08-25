import { TrackProgressMap } from "../../domain/playback"
import { isSameTrack } from "../../domain/track"
import { updateMetadata, updateMetadataWithCurrent } from "../../infra/metadataHelper"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  progressPath,
  RoomControlMessage,
} from "../metadataSchema"

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
