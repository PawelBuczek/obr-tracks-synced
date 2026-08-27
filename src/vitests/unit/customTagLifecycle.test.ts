import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  metadata: {} as Record<string, unknown>,
  updateMetadataWithCurrent: vi.fn(),
  setMetadata: vi.fn((metadata: Record<string, unknown>) => {
    mocks.metadata = metadata
  }),
  resetMetadata: () => {
    mocks.metadata = {}
  },
}))

vi.mock("../../infra/metadataHelper", () => ({
  updateMetadataWithCurrent: mocks.updateMetadataWithCurrent,
}))

import { customTagsPath, encodeLibrary, extractLibrary, libraryPath } from "../../room/metadataSchema"
import {
  createCustomTag,
  deleteCustomTag,
  renameCustomTag,
} from "../../room/state/customTags"

describe("custom tag lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resetMetadata()

    mocks.updateMetadataWithCurrent.mockImplementation(async (transform) => {
      const update = await transform(mocks.metadata)
      if (update) {
        mocks.setMetadata({
          ...mocks.metadata,
          ...update,
        })
      }
      return update
    })
  })

  it("creates the lowest free custom tag id and rejects duplicates and invalid names", async () => {
    mocks.metadata = {
      [customTagsPath]: {
        "85": "Tavern",
        "87": "Forest",
      },
      [libraryPath]: encodeLibrary([]),
    }

    const created = await createCustomTag("  quest  ")
    expect(created.changed).toBe(true)
    expect(created.customTags).toEqual({
      "85": "Tavern",
      "87": "Forest",
      "86": "quest",
    })

    const duplicate = await createCustomTag("  focus  ")
    expect(duplicate.changed).toBe(false)
    expect(duplicate.rejections).toEqual([
      { reason: "duplicate-name", count: 1 },
    ])

    const tooLong = await createCustomTag("1234567890123456")
    expect(tooLong.changed).toBe(false)
    expect(tooLong.rejections).toEqual([
      { reason: "name-too-long", count: 1 },
    ])
  })

  it("renames a custom tag without changing track numeric ids", async () => {
    mocks.metadata = {
      [customTagsPath]: {
        "85": "Tavern",
      },
      [libraryPath]: encodeLibrary([
        { title: "Track A", url: "https://example.com/a.mp3", tags: [85, 3], offset: 12 },
      ]),
    }

    const renamed = await renameCustomTag(85, "  Guild  ")

    expect(renamed.changed).toBe(true)
    expect(renamed.customTags).toEqual({ "85": "Guild" })
    expect(mocks.metadata[customTagsPath]).toEqual({ "85": "Guild" })
    expect(extractLibrary(mocks.metadata)).toEqual([
      { title: "Track A", url: "https://example.com/a.mp3", tags: [85, 3], offset: 12 },
    ])
  })

  it("deletes a custom tag and strips only that id from every track in the same transform", async () => {
    mocks.metadata = {
      [customTagsPath]: {
        "85": "Tavern",
        "86": "Guild",
      },
      [libraryPath]: encodeLibrary([
        { title: "Track A", url: "https://example.com/a.mp3", tags: [85, 3], offset: 10 },
        { title: "Track B", url: "https://example.com/b.mp3", tags: [86, 3, 85], offset: 0 },
      ]),
    }

    const deleted = await deleteCustomTag(85)

    expect(deleted.changed).toBe(true)
    expect(deleted.customTags).toEqual({ "86": "Guild" })
    expect(deleted.library).toEqual([
      { title: "Track A", url: "https://example.com/a.mp3", tags: [3], offset: 10 },
      { title: "Track B", url: "https://example.com/b.mp3", tags: [86, 3], offset: 0 },
    ])
    expect(mocks.metadata[customTagsPath]).toEqual({ "86": "Guild" })
    expect(extractLibrary(mocks.metadata)).toEqual(deleted.library)
  })

  it("writes only the redesigned room keys for custom-tag lifecycle updates", async () => {
    mocks.metadata = {
      [customTagsPath]: { "85": "Tavern" },
      [libraryPath]: encodeLibrary([
        { title: "Track A", url: "https://example.com/a.mp3", tags: [85], offset: 18 },
      ]),
    }

    await createCustomTag("Quest")
    const created = await createCustomTag("Quest")
    expect(created.rejections).toEqual([{ reason: "duplicate-name", count: 1 }])

    const renamed = await renameCustomTag(85, "  Guild  ")
    expect(renamed.customTags).toEqual({ "85": "Guild", "86": "Quest" })

    const deleted = await deleteCustomTag(85)
    expect(deleted.library).toEqual([
      { title: "Track A", url: "https://example.com/a.mp3", tags: [], offset: 18 },
    ])
    expect(deleted.customTags).toEqual({ "86": "Quest" })

    expect(mocks.metadata).toEqual({
      [customTagsPath]: { "86": "Quest" },
      [libraryPath]: encodeLibrary([
        { title: "Track A", url: "https://example.com/a.mp3", tags: [], offset: 18 },
      ]),
    })
    expect("progress" in mocks.metadata).toBe(false)
    expect("libraryOrder" in mocks.metadata).toBe(false)
    expect("librarySortMode" in mocks.metadata).toBe(false)
  })
})
