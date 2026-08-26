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

      const nextMetadata = {
        ...current,
        ...update,
      }

      for (const key of Object.keys(update)) {
        if (update[key] === undefined) {
          delete nextMetadata[key]
        }
      }

      await OBR.room.setMetadata(nextMetadata)
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
