import { beforeEach, describe, expect, it, vi } from "vitest"
import { Action } from "../../domain/playback"
import { isSameTrack } from "../../domain/track"
import {
  deleteTrackFromRoomLibrary,
  mergeTracksIntoRoomLibrary,
  writeControlAndProgress,
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

describe("conflict invariants", () => {
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

  it("keeps one logical track for dropbox url variants", async () => {
    const shareUrl = "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0"
    const directUrl = "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1"

    await mergeTracksIntoRoomLibrary([
      {
        title: "Title A",
        url: shareUrl,
        tags: ["a"],
      },
    ])

    await mergeTracksIntoRoomLibrary([
      {
        title: "Title B",
        url: directUrl,
        tags: ["b"],
      },
    ])

    const library = mocks.metadata[libraryPath] as Array<{
      title: string
      url: string
      tags: string[]
    }>

    expect(library).toHaveLength(1)
    expect(isSameTrack(library[0], { title: "", url: shareUrl, tags: [] })).toBe(true)
    expect(library[0].title).toBe("Title B")
  })

  it("does not allow stale control id to overwrite current playback state", async () => {
    const track = {
      title: "Track",
      url: "https://example.com/track.mp3",
      tags: [],
    }

    mocks.metadata = {
      [libraryPath]: [track],
      [progressPath]: {
        [track.url]: 10,
      },
      [controlPath]: {
        id: "current-id",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 10,
        duration: 120,
        track,
      },
    }

    await writeControlAndProgress(
      {
        id: "stale-write",
        time: new Date("2026-01-01T00:00:01.000Z"),
        action: Action.Pause,
        offset: 11,
        duration: 120,
        track,
      },
      {
        [track.url]: 11,
      },
      {
        expectedControlId: "old-id",
      },
    )

    expect(mocks.metadata[controlPath]).toEqual(
      expect.objectContaining({ id: "current-id", action: Action.Play }),
    )
    expect(mocks.metadata[progressPath]).toEqual({
      [track.url]: 10,
    })
  })

  it("does not allow playback writes for a track that is no longer in library", async () => {
    const removedTrack = {
      title: "Removed",
      url: "https://example.com/removed.mp3",
      tags: [],
    }

    const survivorTrack = {
      title: "Survivor",
      url: "https://example.com/survivor.mp3",
      tags: [],
    }

    mocks.metadata = {
      [libraryPath]: [removedTrack, survivorTrack],
      [progressPath]: {
        [removedTrack.url]: 12,
        [survivorTrack.url]: 0,
      },
      [controlPath]: {
        id: "playing-removed",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 12,
        duration: 300,
        track: removedTrack,
      },
    }

    await deleteTrackFromRoomLibrary(removedTrack)

    await writeControlAndProgress(
      {
        id: "late-play",
        time: new Date("2026-01-01T00:00:03.000Z"),
        action: Action.Play,
        offset: 2,
        duration: 300,
        track: removedTrack,
      },
      {
        [removedTrack.url]: 2,
        [survivorTrack.url]: 0,
      },
    )

    expect(mocks.metadata[libraryPath]).toEqual([survivorTrack])
    expect(mocks.metadata[controlPath]).toBeUndefined()
    expect(mocks.metadata[progressPath]).toEqual({
      [survivorTrack.url]: 0,
    })
  })
})
