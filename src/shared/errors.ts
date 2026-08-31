import { Track, toString } from "../domain/track"
import { showNotification } from "./notify"
import { TrackValidation } from "./utils"

// Shorter dismiss for the common "track failed to play" case so it doesn't linger.
const AUDIO_PLAY_ERROR_DISMISS_MS = 6_000

export class ObrError extends Error {
  constructor(message: string, track?: Track, validation?: TrackValidation) {
    const dismissAfterMs = message.startsWith("Audio error: Unable to play track")
      ? AUDIO_PLAY_ERROR_DISMISS_MS
      : undefined

    if (validation) {
      message +=
        ": " +
        Object.values(validation)
          .filter(v => v)
          .join(" / ")
    }

    if (track) {
      message += ": " + toString(track)
    }

    super(message)
    showNotification(message, "ERROR", dismissAfterMs)
  }
}
