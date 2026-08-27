import { beforeEach, describe, expect, it, vi } from "vitest"

import { getBuiltinTagId } from "../../domain/tags"
import { canonicalizeTrackUrl, Track } from "../../domain/track"
import { csvToTracks, TracksToCsv } from "../../io/csv"
import fixtureCsv from "./fixtures/large-import-100-tracks.csv?raw"
import {
  addTrackToLibrary,
  clearLibrary,
  getLibrary,
  mergeLibrary,
} from "../../room/library"
import { encodeLibrary } from "../../room/metadataSchema"
import { key } from "../../shared/key"

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(() => Promise.resolve({})),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(() => vi.fn()),
  updateMetadata: vi.fn(),
  updateMetadataWithCurrent: vi.fn(),
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

const libraryPath = key("library")

function normalizeExpectedTrack(track: Track): Track {
  return {
    ...track,
    url: canonicalizeTrackUrl(track.url),
    tags: track.tags.map(tag =>
      typeof tag === "number" ? tag : (getBuiltinTagId(tag) ?? tag.toLowerCase()),
    ),
    offset: 0,
  }
}

describe("CSV round-trip simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: encodeLibrary([]),
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

  it("exports library to csv, clears, re-imports, and validates library matches", async () => {
    const originalTracks: Track[] = [
      {
        title: "Ambient Soundscape",
        url: "https://www.dropbox.com/scl/fi/fl4h8fc7nx3ogaep7g3ui/adventuring.mp3?rlkey=iqp87ke0vbrgm6ucv8zu97xqw&st=9wrfogff&dl=0",
        tags: ["ambient", "calming"],
      },
      {
        title: "Epic Battle Music",
        url: "https://example.com/epic-battle.mp3",
        tags: ["action", "intense"],
      },
      {
        title: "Forest Walk",
        url: "https://example.com/forest-walk.mp3",
        tags: [],
      },
      {
        title: "Mysterious Dungeon",
        url: "https://www.dropbox.com/scl/fi/zkr9ikc4a72kzkwc4olj0/ambient.mp3?rlkey=tluhhdm259uw9l507hhnfy96p&st=2ebr2ea9&dl=0",
        tags: ["mysterious", "dark", "atmospheric"],
      },
    ]

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: encodeLibrary([]),
    })

    for (const track of originalTracks) {
      await addTrackToLibrary(track)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: encodeLibrary(getLibrary()),
      })
    }

    const addedLibrary = getLibrary()
    expect(addedLibrary).toHaveLength(originalTracks.length)
    originalTracks.forEach(track => {
      expect(addedLibrary).toContainEqual(normalizeExpectedTrack(track))
    })

    const csv = TracksToCsv(getLibrary())

    expect(csv).toContain("url,title,tags")
    expect(csv).toContain("Ambient Soundscape")
    expect(csv).toContain("Epic Battle Music")
    expect(csv).toContain("Forest Walk")
    expect(csv).toContain("Mysterious Dungeon")

    await clearLibrary()
    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: encodeLibrary([]),
    })

    expect(getLibrary()).toHaveLength(0)

    const { tracks: importedTracks, errors } = csvToTracks(csv)

    expect(errors).toHaveLength(0)

    for (const track of importedTracks) {
      await addTrackToLibrary(track)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: encodeLibrary(getLibrary()),
      })
    }

    const finalLibrary = getLibrary()
    expect(finalLibrary).toHaveLength(originalTracks.length)
    originalTracks.forEach(track => {
      expect(finalLibrary).toContainEqual(normalizeExpectedTrack(track))
    })

    for (const originalTrack of originalTracks) {
      const matchingTrack = finalLibrary.find(t => {
        const normalized = normalizeExpectedTrack(originalTrack)
        return (
          t.title === normalized.title &&
          t.url === normalized.url &&
          t.tags.length === normalized.tags.length &&
          t.tags.every(tag => normalized.tags.includes(tag as never))
        )
      })
      expect(matchingTrack).toBeDefined()
    }
  })

  it("imports the large 100-track fixture into the library", async () => {
    const { tracks, errors } = csvToTracks(fixtureCsv)

    expect(errors).toEqual([])
    expect(tracks).toHaveLength(100)

    const outcome = await mergeLibrary(tracks)

    expect(outcome?.rejections).toEqual([
      { reason: "url-too-long", count: 1 },
      { reason: "library-over-limit", count: 55 },
    ])
    expect(getLibrary()).toHaveLength(44)
    expect(getLibrary()).not.toContainEqual(normalizeExpectedTrack(tracks[1]))
  })

  it("handles special characters and unicode in track names during csv round-trip", async () => {
    const specialTracks: Track[] = [
      {
        title: "Café Ambiance",
        url: "https://example.com/cafe.mp3",
        tags: ["français"],
      },
      {
        title: "日本の風景",
        url: "https://example.com/japan.mp3",
        tags: ["日本語", "ambient"],
      },
      {
        title: "Track with, comma",
        url: "https://example.com/comma.mp3",
        tags: ["special"],
      },
      {
        title: 'Track with "quotes"',
        url: "https://example.com/quotes.mp3",
        tags: ["special"],
      },
    ]

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: encodeLibrary([]),
    })

    for (const track of specialTracks) {
      await addTrackToLibrary(track)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: encodeLibrary(getLibrary()),
      })
    }

    const csv = TracksToCsv(getLibrary())
    const { tracks: importedTracks, errors } = csvToTracks(csv)

    expect(errors).toHaveLength(0)
    expect(importedTracks).toHaveLength(specialTracks.length)
    specialTracks.forEach(track => {
      expect(importedTracks).toContainEqual(normalizeExpectedTrack(track))
    })
  })

  it("preserves tag order and multiplicity during csv round-trip", async () => {
    const tracksWithTags: Track[] = [
      {
        title: "Multi-tag Track",
        url: "https://example.com/multi.mp3",
        tags: ["ambient", "relaxing", "meditation", "sleep"],
      },
      {
        title: "Empty Tags Track",
        url: "https://example.com/empty.mp3",
        tags: [],
      },
      {
        title: "Single Tag",
        url: "https://example.com/single.mp3",
        tags: ["action"],
      },
    ]

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: encodeLibrary([]),
    })

    for (const track of tracksWithTags) {
      await addTrackToLibrary(track)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: encodeLibrary(getLibrary()),
      })
    }

    const csv = TracksToCsv(getLibrary())
    const { tracks: importedTracks, errors } = csvToTracks(csv)

    expect(errors).toHaveLength(0)
    expect(importedTracks).toHaveLength(tracksWithTags.length)

    for (const track of tracksWithTags) {
      const expected = normalizeExpectedTrack(track)
      const importedTrack = importedTracks.find(
        t =>
          t.title === expected.title &&
          t.url === expected.url &&
          t.tags.length === expected.tags.length &&
          t.tags.every(tag => expected.tags.includes(tag as never)),
      )
      expect(importedTrack).toBeDefined()
      expect(importedTrack?.tags).toEqual(expected.tags)
    }
  })
})
