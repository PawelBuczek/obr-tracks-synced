import { vi, type Mock } from "vitest"

type MetadataMocks = {
  metadata: Record<string, unknown>
  updateMetadata: Mock
  updateMetadataWithCurrent: Mock
}

export function resetMetadataMocks(mocks: MetadataMocks) {
  vi.clearAllMocks()
  mocks.metadata = {}

  mocks.updateMetadata.mockImplementation((update: Record<string, unknown>) => {
    mocks.metadata = {
      ...mocks.metadata,
      ...update,
    }
  })

  mocks.updateMetadataWithCurrent.mockImplementation(async transform => {
    const update = await transform(mocks.metadata)
    if (update) {
      mocks.metadata = {
        ...mocks.metadata,
        ...update,
      }
    }
  })
}