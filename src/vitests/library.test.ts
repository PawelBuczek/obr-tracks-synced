import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(() => Promise.resolve({})),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(() => vi.fn()),
  updateMetadata: vi.fn(),
}))

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    isAvailable: false,
    onReady: vi.fn(),
    room: {
      getMetadata: mocks.getMetadata,
      setMetadata: mocks.setMetadata,
      onMetadataChange: mocks.onMetadataChange,
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

import {
  clearLibrary,
  deleteTrackFromLibrary,
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

  it("clears control metadata when deleting a track", async () => {
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
    })

    await deleteTrackFromLibrary(track)

    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: [],
        [progressPath]: {},
        [controlPath]: undefined,
      }),
    )
  })
})
