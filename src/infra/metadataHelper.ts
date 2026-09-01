import OBR, { Metadata } from "@owlbear-rodeo/sdk"

// serializes all writes
let metadataWriteQueue = Promise.resolve()

export function updateMetadataWithCurrent(
  transform: (current: Metadata) => Metadata | undefined | Promise<Metadata | undefined>,
) {
  metadataWriteQueue = metadataWriteQueue
    .catch(() => {})
    .then(async () => {
      const current = await OBR.room.getMetadata()
      console.log("[metadataHelper] getMetadata (before transform):", current)

      const update = await transform(current)

      if (!update) {
        console.log("[metadataHelper] transform returned no update, skipping setMetadata")
        return
      }

      // OBR.room.setMetadata is a shallow merge/spread server-side, not a full
      // replace: a key simply absent from the payload is left untouched, so it
      // can never be used to delete a field. Send an explicit null instead,
      // which the extractX() readers already treat as "absent" (isRecord check).
      const payload: Metadata = { ...update }
      for (const key of Object.keys(update)) {
        if (update[key] === undefined) {
          payload[key] = null
        }
      }

      console.log("[metadataHelper] setMetadata (payload sent to OBR):", payload)
      await OBR.room.setMetadata(payload)
    })

  return metadataWriteQueue
}

export function updateMetadata(update: Metadata) {

  return updateMetadataWithCurrent(() => update)
}

export async function getMetadataSize(): Promise<number> {
  const metadata = await OBR.room.getMetadata()
      if (!metadata) {
        console.error("Failed to get metadata size: metadata is undefined")
        return 0
      }

  return new TextEncoder().encode(JSON.stringify(metadata)).length
}
