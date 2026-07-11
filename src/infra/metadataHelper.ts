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
      const update = await transform(current)

      if (!update) {
        return
      }

      await OBR.room.setMetadata({
        ...current,
        ...update,
      })
    })

  return metadataWriteQueue
}

export function updateMetadata(update: Metadata) {
  console.trace("[metadata]", update)

  return updateMetadataWithCurrent(() => update)
}
