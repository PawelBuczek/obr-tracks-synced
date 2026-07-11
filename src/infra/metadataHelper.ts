import OBR, { Metadata } from "@owlbear-rodeo/sdk"

// serializes all writes
let metadataWriteQueue = Promise.resolve()

export function updateMetadata(update: Metadata) {
  console.trace("[metadata]", update)

  metadataWriteQueue = metadataWriteQueue
    .catch(() => {})
    .then(async () => {
      const current = await OBR.room.getMetadata()

      await OBR.room.setMetadata({
        ...current,
        ...update,
      })
    })

  return metadataWriteQueue
}
