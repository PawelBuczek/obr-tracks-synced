import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(() => Promise.resolve({})),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(() => vi.fn()),
  updateMetadata: vi.fn(),
  updateMetadataWithCurrent: vi.fn(),
  stopPlayback: vi.fn(),
  metadata: {},
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
  getMetadataSize: vi.fn(() => Promise.resolve(JSON.stringify(mocks.metadata).length)),
}))

vi.mock("../../room/mb", async () => {
  const actual = await vi.importActual("../../room/mb")

  return {
    ...actual,
    stopPlayback: mocks.stopPlayback,
  }
})

import {
  clearLibrary,
  deleteTrackFromLibrary,
  addTrackToLibrary,
  getLibrary,
  mergeLibrary,
} from "../../room/library"

import { controlPath } from "../../room/mb"
import { encodeLibrary } from "../../room/metadataSchema"
import { key } from "../../shared/key"

const libraryPath = key("library")
const progressPath = key("progress")

function makeTracks(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    title: `T${index}`,
    url: `https://x/${index}.mp3`,
    tags: [],
  }))
}

const customTagIds = [85, 86, 87, 88, 89]
const realisticCustomTags = [
  "customtagname01",
  "dartontagmane02",
  "perlixtagshad03",
  "stonestagmana04",
  "warrimtagfire05",
]

function getEncodedLibrarySizeBytes(library: unknown[]): number {
  return new TextEncoder().encode(
    JSON.stringify({ [libraryPath]: encodeLibrary(library) }),
  ).length
}

function randomLetters(length: number, seed: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz"
  let value = seed
  let result = ""

  for (let index = 0; index < length; index++) {
    value = (value * 1664525 + 1013904223) >>> 0
    result += alphabet[value % alphabet.length]
  }

  return result
}

function makeRealisticTracks(count: number, dropboxOnly = false) {
  return Array.from({ length: count }, (_, index) => ({
    title: randomLetters(15, index),
    url:
      dropboxOnly || index % 3 === 0
        ? `https://dl.dropboxusercontent.com/scl/fi/${randomLetters(20, index)}/${randomLetters(15, index + 1000)}.mp3?rlkey=${randomLetters(26, index + 2000)}&st=${randomLetters(8, index + 3000)}&dl=1`
        : index % 3 === 1
          ? `https://e.pcloud.link/publink/show?code=X${randomLetters(15, index)}`
          : `https://app.box.com/s/${randomLetters(15, index)}`,
    tags: customTagIds.slice(0, (index % customTagIds.length) + 1),
  }))
}

// Deflate compresses repeated characters extremely well, so use
// non-repeating content to keep this fixture over the size cap post-compression.
function incompressibleTag(length: number): string {
  let tag = ""
  let counter = 0
  while (tag.length < length) {
    tag += (counter++).toString(36)
  }
  return tag.slice(0, length)
}

// Bypasses only the metadata size-cap check (which encodes the wrapped
// `{ [libraryPath]: encoded }` JSON) so tests can focus on the 200-track cap.
// Must not short-circuit other TextEncoder callers (e.g. fflate's internal
// UTF-8 encoding used by encodeLibrary/decodeLibraryEntries).
async function withoutMetadataLimit<T>(callback: () => Promise<T>): Promise<T> {
  const originalEncode = TextEncoder.prototype.encode
  const encode = vi
    .spyOn(TextEncoder.prototype, "encode")
    .mockImplementation(function (this: TextEncoder, input?: string) {
      if (typeof input === "string" && input.includes(libraryPath)) {
        return new Uint8Array()
      }
      return originalEncode.call(this, input)
    })

  try {
    return await callback()
  } finally {
    encode.mockRestore()
  }
}

describe("library playback cleanup", () => {
beforeEach(() => {
  vi.clearAllMocks()

  mocks.getMetadata.mockResolvedValue({
    [libraryPath]: encodeLibrary([]),
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

    expect(getLibrary()).toContainEqual({ ...track, offset: 0 })

    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: encodeLibrary([{ ...track, offset: 0 }]),
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
      [libraryPath]: encodeLibrary([originalTrack]),
      [progressPath]: {},
    })

    const updatedTrack = {
      title: "Updated Track",
      url: "https://example.com/test.mp3",
      tags: ["two"],
    }

    await addTrackToLibrary(updatedTrack)

    expect(getLibrary()).toContainEqual({ ...updatedTrack, offset: 0 })
    expect(getLibrary()).toHaveLength(1)
    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: encodeLibrary([{ ...updatedTrack, offset: 0 }]),
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
      [libraryPath]: encodeLibrary([originalTrack]),
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
        [libraryPath]: encodeLibrary([
          {
            title: "Updated Track",
            url: playingTrack.url,
            tags: ["updated", 3],
            offset: 0,
          },
        ]),
        [controlPath]: expect.objectContaining({
          track: {
            title: "Updated Track",
            url: playingTrack.url,
            tags: ["updated", 3],
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
      [libraryPath]: encodeLibrary([existingTrack]),
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
    expect(getLibrary()).toEqual([{ ...existingTrack, offset: 0 }])
  })

  it("rejects adding a new track when library metadata is already over 6 KB", async () => {
    const oversizedTrack = {
      title: "Huge Track",
      url: "https://example.com/huge.mp3",
      tags: [incompressibleTag(7000)],
    }

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: encodeLibrary([oversizedTrack]),
      [progressPath]: {},
    })

    await expect(
      addTrackToLibrary({
        title: "New Track",
        url: "https://example.com/new-track.mp3",
        tags: [],
      }),
    ).rejects.toThrow("library metadata is over 6 KB limit")

    expect(mocks.updateMetadata).not.toHaveBeenCalled()
    expect(getLibrary()).toEqual([{ ...oversizedTrack, offset: 0 }])
  })

  it("allows updating an existing track even when library metadata is over 6 KB", async () => {
    const oversizedTrack = {
      title: "Huge Track",
      url: "https://example.com/huge.mp3",
      tags: [incompressibleTag(7000)],
    }

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: encodeLibrary([oversizedTrack]),
      [progressPath]: {},
    })

    await addTrackToLibrary({
      title: "Updated Huge Track",
      url: "https://example.com/huge.mp3",
      tags: ["updated"],
    })

    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: encodeLibrary([
          {
            title: "Updated Huge Track",
            url: "https://example.com/huge.mp3",
            tags: ["updated"],
            offset: 0,
          },
        ]),
      }),
    )
  })

  it("measures realistic mixed-provider and Dropbox-only library capacity", async () => {
    const mixedProviderTracks = makeRealisticTracks(201)
    const dropboxOnlyTracks = makeRealisticTracks(201, true)
    const mixedProviderOutcome = await mergeLibrary(mixedProviderTracks)
    const dropboxOnlyOutcome = await mergeLibrary(dropboxOnlyTracks)

    console.info("Library capacity estimate", {
      customTags: realisticCustomTags,
      mixedProvider: {
        tracks: mixedProviderOutcome.library.length,
        bytes: getEncodedLibrarySizeBytes(mixedProviderOutcome.library),
        rejections: JSON.stringify(mixedProviderOutcome.rejections),
      },
      dropboxOnly: {
        tracks: dropboxOnlyOutcome.library.length,
        bytes: getEncodedLibrarySizeBytes(dropboxOnlyOutcome.library),
        rejections: JSON.stringify(dropboxOnlyOutcome.rejections),
      },
    })

    expect(new Set(mixedProviderTracks.map(track => track.title))).toHaveLength(201)
    expect(new Set(mixedProviderTracks.map(track => track.url))).toHaveLength(201)
    expect(new Set(dropboxOnlyTracks.map(track => track.title))).toHaveLength(201)
    expect(new Set(dropboxOnlyTracks.map(track => track.url))).toHaveLength(201)
    expect(mixedProviderOutcome.library.length).toBe(137)
    expect(mixedProviderOutcome.rejections).toEqual([
      { reason: "library-over-limit", count: 64 },
    ])
    expect(dropboxOnlyOutcome.library.length).toBe(75)
    expect(dropboxOnlyOutcome.rejections).toEqual([
      { reason: "library-over-limit", count: 126 },
    ])
  })

  it("accepts a new track when the library has 199 tracks", async () => {
    await withoutMetadataLimit(async () => {
      const tracks = makeTracks(199)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: encodeLibrary(tracks),
        [progressPath]: {},
      })

      await addTrackToLibrary({
        title: "T199",
        url: "https://x/199.mp3",
        tags: [],
      })

      expect(getLibrary()).toHaveLength(200)
      expect(mocks.updateMetadata).toHaveBeenCalled()
    })
  })

  it("rejects a new track when the library already has 200 tracks", async () => {
    await withoutMetadataLimit(async () => {
      const tracks = makeTracks(200)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: encodeLibrary(tracks),
        [progressPath]: {},
      })

      await expect(
        addTrackToLibrary({
          title: "T200",
          url: "https://x/200.mp3",
          tags: [],
        }),
      ).rejects.toThrow("library is limited to 200 tracks")

      expect(getLibrary()).toHaveLength(200)
      expect(mocks.updateMetadata).not.toHaveBeenCalled()
    })
  })

  it("rejects only tracks beyond 200 during a bulk merge", async () => {
    await withoutMetadataLimit(async () => {
      const existingTracks = makeTracks(198)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: encodeLibrary(existingTracks),
        [progressPath]: {},
      })

      const outcome = await mergeLibrary(
        makeTracks(5).map((track, index) => ({
          ...track,
          title: `N${index}`,
          url: `https://x/n${index}.mp3`,
        })),
      )

      expect(outcome.rejections).toEqual([
        { reason: "library-track-limit", count: 3 },
      ])
      expect(getLibrary()).toHaveLength(200)
    })
  })

  it("allows updating an existing track when the library has 200 tracks", async () => {
    await withoutMetadataLimit(async () => {
      const tracks = makeTracks(200)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: encodeLibrary(tracks),
        [progressPath]: {},
      })

      await addTrackToLibrary({
        title: "Updated",
        url: "https://x/0.mp3",
        tags: [],
      })

      expect(getLibrary()).toHaveLength(200)
      expect(getLibrary()[0]).toMatchObject({
        title: "Updated",
        url: "https://x/0.mp3",
      })
      expect(mocks.updateMetadata).toHaveBeenCalled()
    })
  })


  it("clears control metadata when clearing the library", async () => {
    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: encodeLibrary([
        {
          title: "Track",
          url: "https://example.com/track.mp3",
          tags: [],
        },
      ]),
      [progressPath]: {
        "https://example.com/track.mp3": 11,
      },
    })

    await clearLibrary()

    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: encodeLibrary([]),
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
      [libraryPath]: encodeLibrary([track]),
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


    expect(mocks.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        [libraryPath]: encodeLibrary([]),
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
      [libraryPath]: encodeLibrary([
        track,
        playingTrack,
      ]),
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
        [libraryPath]: encodeLibrary([
          { ...playingTrack, offset: 0 },
        ]),
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
