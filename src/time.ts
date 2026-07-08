import { ObrError } from "./errors"
import { getTimeSyncUrl } from "./timeUrl"

const isBrowser = typeof window !== "undefined"

let skew = 0

export function now() {
  return new Date(new Date().getTime() + skew)
}

export function setSkew(callback: () => void) {
  if (!isBrowser) {
    return
  }

  import("@owlbear-rodeo/sdk").then(({ default: OBR }) => {

    OBR.onReady(() => {
      const timeSyncUrl = getTimeSyncUrl(window.location.href)
      console.log("fetching time from", timeSyncUrl)
      fetch(timeSyncUrl, { cache: "no-store" }).then(r => {
        // get the now time as soon as possible after the fetch
        const now = new Date()

        // validate the header exists
        const dateHeader = r.headers.get("date")
        if (dateHeader === null) {
          throw new ObrError("Date header failure: Header is null")
        }

        // validate the header is a valid time
        const serverTime = new Date(dateHeader)
        if (isNaN(serverTime.getTime())) {
          throw new ObrError(
            `Date header failure: Unable to convert into Date: ${dateHeader}`,
          )
        }

        // set the skew
        skew = serverTime.getTime() - now.getTime()
        console.log(
          `server time: ${serverTime}\nlocal time:  ${now}\nskew: ${skew}`,
        )

        // call the call back
        callback()
      })
    })
  })
}
