import OBR from "@owlbear-rodeo/sdk"
import { ObrError } from "../shared/errors"
import { getTimeSyncUrl } from "../shared/timeUrl"

const isBrowser = typeof window !== "undefined"

let skew = 0

export function now() {
  return new Date(new Date().getTime() + skew)
}

export function setSkew(callback: () => void) {
  if (!isBrowser) {
    return
  }

  OBR.onReady(() => {
    const timeSyncUrl = getTimeSyncUrl(window.location.href)
    console.log("fetching time from", timeSyncUrl)

    fetch(timeSyncUrl, { cache: "no-store" }).then(r => {
      const now = new Date()

      const dateHeader = r.headers.get("date")
      if (dateHeader === null) {
        throw new ObrError("Date header failure: Header is null")
      }

      const serverTime = new Date(dateHeader)
      if (isNaN(serverTime.getTime())) {
        throw new ObrError(
          `Date header failure: Unable to convert into Date: ${dateHeader}`,
        )
      }

      skew = serverTime.getTime() - now.getTime()

      console.log(
        `server time: ${serverTime}\nlocal time:  ${now}\nskew: ${skew}`,
      )

      callback()
    })
  })
}
