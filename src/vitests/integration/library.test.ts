import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(() => Promise.resolve({})),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(() => vi.fn()),
  updateMetadata: vi.fn(),
  updateMetadataWithCurrent: vi.fn(),
  stopPlayback: vi.fn(),
  removeTrackProgress: vi.fn((progress) => progress),
}))

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    isAvailable: true,
    onReady: (callback: () => void) => callback(),
    room: {
      getMetadata: mocks.getMetadata,
      setMetadata: mocks.setMetadata,
      onMetadataChange: mocks.onMetadataChange,
    },
    notification: {
      show: vi.fn(),
    },
  },
}))

vi.mock("firebase/analytics", () => ({
  logEvent: vi.fn(),
  setConsent: vi.fn(),
  getAnalytics: vi.fn(() => ({})),
}))

vi.mock("../../infra/firebase", () => ({
  analytics: {},
}))

vi.mock("../../infra/metadataHelper", () => ({
  updateMetadata: mocks.updateMetadata,
  updateMetadataWithCurrent: mocks.updateMetadataWithCurrent,
}))

vi.mock("../../room/mb", async () => {
  const actual = await vi.importActual("../../room/mb")

  return {
    ...actual,
    stopPlayback: mocks.stopPlayback,
  }
})

vi.mock("../../domain/playback", async () => {
  const actual = await vi.importActual("../../domain/playback")

  return {
    ...actual,
    removeTrackProgress: mocks.removeTrackProgress,
  }
})

import {
  clearLibrary,
  deleteTrackFromLibrary,
  addTrackToLibrary,
  getLibrary,
} from "../../room/library"

import { controlPath } from "../../room/mb"
import { key } from "../../shared/key"

const libraryPath = key("library")
const progressPath = key("progress")

describe("library playback cleanup", () => {
beforeEach(() => {
  vi.clearAllMocks()

  mocks.getMetadata.mockResolvedValue({
    [libraryPath]: [],
    [progressPath]: {},
  })

  mocks.updateMetadata.mockResolvedValue(undefined)
  mocks.updateMetadataWithCurrent.mockImplementation(async (transform) => {
    const current = await mocks.getMetadata()
    const update = await transform(current)

    if (update) {
      return mocks.updateMetadata(update)
    }

    return undefined
  })
})

  it("adds a track to the library", async () => {
    const track = {
      title: "Test Track",
      url: "https://example.com/test.mp3",
      tags: [],
    }

    await addTrackToLibrary(track)

    expect(getLibrary()).toContainEqual(track)

    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: [track],
      }),
    )
  })

  it("updates an existing track when the same url is added again", async () => {
    const originalTrack = {
      title: "Original Track",
      url: "https://example.com/test.mp3",
      tags: ["one"],
    }

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [originalTrack],
      [progressPath]: {},
    })

    const updatedTrack = {
      title: "Updated Track",
      url: "https://example.com/test.mp3",
      tags: ["two"],
    }

    await addTrackToLibrary(updatedTrack)

    expect(getLibrary()).toContainEqual(updatedTrack)
    expect(getLibrary()).toHaveLength(1)
    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: [updatedTrack],
      }),
    )
  })

  it("refreshes currently playing metadata when adding a track with the same url", async () => {
    const originalTrack = {
      title: "Original Track",
      url: "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0",
      tags: ["old"],
    }

    const playingTrack = {
      title: "Original Track",
      url: "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1",
      tags: ["old"],
    }

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [originalTrack],
      [progressPath]: {
        [playingTrack.url]: 33,
      },
      [controlPath]: {
        id: "playing",
        time: new Date().toISOString(),
        action: 0,
        offset: 0,
        duration: 180,
        track: playingTrack,
      },
    })

    await addTrackToLibrary({
      title: "Updated Track",
      url: "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0",
      tags: ["updated", "focus"],
    })

    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: [
          {
            title: "Updated Track",
            url: "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0",
            tags: ["updated", "focus"],
          },
        ],
        [controlPath]: expect.objectContaining({
          track: {
            title: "Updated Track",
            url: playingTrack.url,
            tags: ["updated", "focus"],
          },
        }),
      }),
    )
  })

  it("rejects adding a track with a duplicate title", async () => {
    const existingTrack = {
      title: "Test Track",
      url: "https://example.com/original.mp3",
      tags: [],
    }

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [existingTrack],
      [progressPath]: {},
    })

    const duplicateTitleTrack = {
      title: "Test Track",
      url: "https://example.com/new.mp3",
      tags: ["different"],
    }

    await expect(addTrackToLibrary(duplicateTitleTrack)).rejects.toThrow(
      "Track validation failed",
    )

    expect(mocks.updateMetadata).not.toHaveBeenCalled()
    expect(getLibrary()).toEqual([existingTrack])
  })


  it("clears control metadata when clearing the library", async () => {
    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [
        {
          title: "Track",
          url: "https://example.com/track.mp3",
          tags: [],
        },
      ],
      [progressPath]: {
        "https://example.com/track.mp3": 11,
      },
    })

    await clearLibrary()

    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: [],
        [progressPath]: {},
        [controlPath]: undefined,
      }),
    )
  })


  it("clears control metadata when deleting a currently playing track", async () => {
    const track = {
      title: "Test Track",
      url: "https://example.com/test.mp3",
      tags: [],
    }

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [track],
      [progressPath]: {
        [track.url]: 42,
      },
      [controlPath]: {
        id: "playing",
        time: new Date().toISOString(),
        action: 0,
        offset: 0,
        duration: 180,
        track,
      },
    })


    await deleteTrackFromLibrary(track)


    expect(mocks.stopPlayback)
      .toHaveBeenCalled()


    expect(mocks.removeTrackProgress)
      .toHaveBeenCalledWith(
        {
          [track.url]: 42,
        },
        track,
      )


    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: [],
        [controlPath]: undefined,
      }),
    )
  })


  it("removes a track without clearing currentMessage when another track is playing", async () => {
    const track = {
      title: "Test Track",
      url: "https://example.com/test.mp3",
      tags: [],
    }

    const playingTrack = {
      title: "Playing Track",
      url: "https://example.com/playing.mp3",
      tags: [],
    }


    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [
        track,
        playingTrack,
      ],
      [progressPath]: {},
      [controlPath]: {
        track: playingTrack,
      },
    })


    await deleteTrackFromLibrary(track)


    expect(mocks.stopPlayback)
      .not
      .toHaveBeenCalled()


    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: [
          playingTrack,
        ],
      }),
    )


    expect(
      mocks.updateMetadata.mock.calls[0][0][controlPath],
    )
      .toBeUndefined()
  })

  it("no-ops delete when track was already removed by another writer", async () => {
    const track = {
      title: "Test Track",
      url: "https://example.com/test.mp3",
      tags: [],
    }

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [],
      [progressPath]: {},
    })

    await deleteTrackFromLibrary(track)

    expect(mocks.updateMetadata).not.toHaveBeenCalled()
    expect(mocks.stopPlayback).not.toHaveBeenCalled()
  })
})
