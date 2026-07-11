import { beforeEach, describe, expect, it, vi } from "vitest"
import { Action } from "../../domain/playback"
import {
  clearRoomLibrary,
  deleteTrackFromRoomLibrary,
  mergeTracksIntoRoomLibrary,
} from "../../room/stateOperations"
import { controlPath, libraryPath, progressPath } from "../../room/metadataSchema"

const mocks = vi.hoisted(() => ({
  metadata: {} as Record<string, unknown>,
  updateMetadata: vi.fn(),
  updateMetadataWithCurrent: vi.fn(),
}))

vi.mock("../../infra/metadataHelper", () => ({
  updateMetadata: mocks.updateMetadata,
  updateMetadataWithCurrent: mocks.updateMetadataWithCurrent,
}))

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    notification: {
      show: vi.fn(),
    },
  },
}))

describe("dual-GM conflict ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.metadata = {}

    mocks.updateMetadata.mockImplementation((update: Record<string, unknown>) => {
      mocks.metadata = {
        ...mocks.metadata,
        ...update,
      }
    })

    mocks.updateMetadataWithCurrent.mockImplementation(async (transform) => {
      const update = await transform(mocks.metadata)

      if (!update) {
        return
      }

      mocks.metadata = {
        ...mocks.metadata,
        ...update,
      }
    })
  })

  it("clear-then-rename keeps the renamed track because the later merge acts on cleared state", async () => {
    const original = {
      title: "Old",
      url: "https://example.com/track.mp3",
      tags: ["a"],
    }

    mocks.metadata = {
      [libraryPath]: [original],
      [progressPath]: {
        [original.url]: 15,
      },
    }

    await clearRoomLibrary()

    const mergeOutcome = await mergeTracksIntoRoomLibrary([
      {
        title: "Renamed",
        url: original.url,
        tags: ["b"],
      },
    ])

    expect(mergeOutcome.changed).toBe(true)
    expect(mocks.metadata[libraryPath]).toEqual([
      {
        title: "Renamed",
        url: original.url,
        tags: ["b"],
      },
    ])
    expect(mocks.metadata[progressPath]).toEqual({})
  })

  it("rename-then-clear ends with an empty library because clear is the final writer", async () => {
    const original = {
      title: "Old",
      url: "https://example.com/track.mp3",
      tags: ["a"],
    }

    mocks.metadata = {
      [libraryPath]: [original],
      [progressPath]: {
        [original.url]: 15,
      },
    }

    const mergeOutcome = await mergeTracksIntoRoomLibrary([
      {
        title: "Renamed",
        url: original.url,
        tags: ["b"],
      },
    ])

    const clearOutcome = await clearRoomLibrary()

    expect(mergeOutcome.changed).toBe(true)
    expect(clearOutcome.changed).toBe(true)
    expect(mocks.metadata[libraryPath]).toEqual([])
    expect(mocks.metadata[progressPath]).toEqual({})
    expect(mocks.metadata[controlPath]).toBeUndefined()
  })

  it("delete-playing-then-rename re-adds the track but keeps playback stopped", async () => {
    const original = {
      title: "Old",
      url: "https://example.com/track.mp3",
      tags: ["a"],
    }

    mocks.metadata = {
      [libraryPath]: [original],
      [progressPath]: {
        [original.url]: 22,
      },
      [controlPath]: {
        id: "playing",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 3,
        duration: 120,
        track: original,
      },
    }

    const deleteOutcome = await deleteTrackFromRoomLibrary(original)

    const mergeOutcome = await mergeTracksIntoRoomLibrary([
      {
        title: "Renamed",
        url: original.url,
        tags: ["b"],
      },
    ])

    expect(deleteOutcome.shouldStopPlayback).toBe(true)
    expect(mergeOutcome.changed).toBe(true)
    expect(mocks.metadata[libraryPath]).toEqual([
      {
        title: "Renamed",
        url: original.url,
        tags: ["b"],
      },
    ])
    expect(mocks.metadata[progressPath]).toEqual({})
    expect(mocks.metadata[controlPath]).toBeUndefined()
  })

  it("rejects duplicate-title merge when another writer already created that title", async () => {
    mocks.metadata = {
      [libraryPath]: [
        {
          title: "Existing",
          url: "https://example.com/existing.mp3",
          tags: ["x"],
        },
      ],
      [progressPath]: {},
    }

    await expect(
      mergeTracksIntoRoomLibrary([
        {
          title: "Existing",
          url: "https://example.com/new.mp3",
          tags: ["y"],
        },
      ]),
    ).rejects.toThrow("Track validation failed")

    expect(mocks.metadata[libraryPath]).toEqual([
      {
        title: "Existing",
        url: "https://example.com/existing.mp3",
        tags: ["x"],
      },
    ])
  })

  it("rename-then-conflicting-add keeps first writer and rejects second duplicate-title add", async () => {
    mocks.metadata = {
      [libraryPath]: [
        {
          title: "Track A",
          url: "https://example.com/a.mp3",
          tags: [],
        },
      ],
      [progressPath]: {},
    }

    const renameOutcome = await mergeTracksIntoRoomLibrary([
      {
        title: "Renamed A",
        url: "https://example.com/a.mp3",
        tags: ["renamed"],
      },
    ])

    await expect(
      mergeTracksIntoRoomLibrary([
        {
          title: "Renamed A",
          url: "https://example.com/b.mp3",
          tags: ["conflict"],
        },
      ]),
    ).rejects.toThrow("Track validation failed")

    expect(renameOutcome.changed).toBe(true)
    expect(mocks.metadata[libraryPath]).toEqual([
      {
        title: "Renamed A",
        url: "https://example.com/a.mp3",
        tags: ["renamed"],
      },
    ])
  })

  it("dropbox url variants are treated as one track for delete-then-merge ordering", async () => {
    const shareUrlTrack = {
      title: "Dropbox",
      url: "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0",
      tags: ["old"],
    }

    const directUrlTrack = {
      title: "Dropbox",
      url: "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1",
      tags: ["old"],
    }

    mocks.metadata = {
      [libraryPath]: [shareUrlTrack],
      [progressPath]: {
        [directUrlTrack.url]: 18,
      },
      [controlPath]: {
        id: "playing",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 5,
        duration: 200,
        track: directUrlTrack,
      },
    }

    const deleteOutcome = await deleteTrackFromRoomLibrary(shareUrlTrack)

    const mergeOutcome = await mergeTracksIntoRoomLibrary([
      {
        title: "Dropbox Updated",
        url: shareUrlTrack.url,
        tags: ["new"],
      },
    ])

    expect(deleteOutcome.shouldStopPlayback).toBe(true)
    expect(mergeOutcome.changed).toBe(true)
    expect(mocks.metadata[libraryPath]).toEqual([
      {
        title: "Dropbox Updated",
        url: shareUrlTrack.url,
        tags: ["new"],
      },
    ])
    expect(mocks.metadata[progressPath]).toEqual({})
    expect(mocks.metadata[controlPath]).toBeUndefined()
  })

  it("dropbox url variants are treated as one track for merge-then-delete ordering", async () => {
    const shareUrlTrack = {
      title: "Dropbox",
      url: "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0",
      tags: ["old"],
    }

    const directUrlTrack = {
      title: "Dropbox",
      url: "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1",
      tags: ["old"],
    }

    mocks.metadata = {
      [libraryPath]: [shareUrlTrack],
      [progressPath]: {
        [directUrlTrack.url]: 18,
      },
      [controlPath]: {
        id: "playing",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 5,
        duration: 200,
        track: directUrlTrack,
      },
    }

    const mergeOutcome = await mergeTracksIntoRoomLibrary([
      {
        title: "Dropbox Updated",
        url: shareUrlTrack.url,
        tags: ["new"],
      },
    ])

    const deleteOutcome = await deleteTrackFromRoomLibrary(shareUrlTrack)

    expect(mergeOutcome.changed).toBe(true)
    expect(deleteOutcome.shouldStopPlayback).toBe(true)
    expect(mocks.metadata[libraryPath]).toEqual([])
    expect(mocks.metadata[progressPath]).toEqual({})
    expect(mocks.metadata[controlPath]).toBeUndefined()
  })
})
