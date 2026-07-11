import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(() => Promise.resolve({})),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(() => vi.fn()),
  updateMetadata: vi.fn(),
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

vi.mock("./firebase", () => ({
  analytics: {},
}))

vi.mock("../metadataHelper", () => ({
  updateMetadata: mocks.updateMetadata,
}))

vi.mock("../mb", async () => {
  const actual = await vi.importActual("../mb")

  return {
    ...actual,
    stopPlayback: mocks.stopPlayback,
  }
})

vi.mock("../playback", async () => {
  const actual = await vi.importActual("../playback")

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
} from "../library"

import { controlPath } from "../mb"
import { key } from "../key"

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
})
