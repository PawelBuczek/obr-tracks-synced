import OBR from "@owlbear-rodeo/sdk"
import { Track, toString } from "../domain/track"
import { TrackValidation } from "./utils"

export class ObrError extends Error {
  constructor(message: string, track?: Track, validation?: TrackValidation) {
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
    OBR.notification.show(message, "ERROR")
  }
}
