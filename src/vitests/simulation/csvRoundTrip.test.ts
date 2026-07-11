import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(() => Promise.resolve({})),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(() => vi.fn()),
  updateMetadata: vi.fn(),
  updateMetadataWithCurrent: vi.fn(),
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

import { csvToTracks, TracksToCsv } from "../../io/csv"
import { Track } from "../../domain/track"
import { addTrackToLibrary, getLibrary, clearLibrary } from "../../room/library"
import { key } from "../../shared/key"

const libraryPath = key("library")

describe("CSV round-trip simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [],
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
    // Create initial library
    const originalTracks: Track[] = [
      {
        title: "Ambient Soundscape",
        url: "https://www.dropbox.com/scl/fi/fl4h8fc7nx3ogaep7g3ui/Adventuring.mp3?rlkey=iqp87ke0vbrgm6ucv8zu97xqw&st=9wrfogff&dl=0",
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
        url: "https://www.dropbox.com/scl/fi/zkr9ikc4a72kzkwc4olj0/Ambient.mp3?rlkey=tluhhdm259uw9l507hhnfy96p&st=2ebr2ea9&dl=0",
        tags: ["mysterious", "dark", "atmospheric"],
      },
    ]

    // Add all tracks to library
    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [],
    })

    for (const track of originalTracks) {
      await addTrackToLibrary(track)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: getLibrary(),
      })
    }

    // Verify all tracks were added (order-agnostic)
    const addedLibrary = getLibrary()
    expect(addedLibrary).toHaveLength(originalTracks.length)
    originalTracks.forEach(track => {
      expect(addedLibrary).toContainEqual(track)
    })

    // Export to CSV
    const csv = TracksToCsv(getLibrary())

    // Verify CSV has correct headers and content
    expect(csv).toContain("url,title,tags")
    expect(csv).toContain("Ambient Soundscape")
    expect(csv).toContain("Epic Battle Music")
    expect(csv).toContain("Forest Walk")
    expect(csv).toContain("Mysterious Dungeon")

    // Clear library
    await clearLibrary()
    mocks.getMetadata.mockResolvedValue({
      [libraryPath]: [],
    })

    expect(getLibrary()).toHaveLength(0)

    // Re-import from CSV
    const { tracks: importedTracks, errors } = csvToTracks(csv)

    // Verify no import errors
    expect(errors).toHaveLength(0)

    // Add re-imported tracks back to library
    for (const track of importedTracks) {
      await addTrackToLibrary(track)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: getLibrary(),
      })
    }

    // Verify re-imported library contains all original tracks (order-agnostic)
    const finalLibrary = getLibrary()
    expect(finalLibrary).toHaveLength(originalTracks.length)
    originalTracks.forEach(track => {
      expect(finalLibrary).toContainEqual(track)
    })

    // Verify each track individually
    for (const originalTrack of originalTracks) {
      const matchingTrack = finalLibrary.find(
        t =>
          t.title === originalTrack.title &&
          t.url === originalTrack.url &&
          t.tags.length === originalTrack.tags.length &&
          t.tags.every(tag => originalTrack.tags.includes(tag)),
      )
      expect(matchingTrack).toBeDefined()
    }
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
      [libraryPath]: [],
    })

    for (const track of specialTracks) {
      await addTrackToLibrary(track)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: getLibrary(),
      })
    }

    // Export and re-import
    const csv = TracksToCsv(getLibrary())
    const { tracks: importedTracks, errors } = csvToTracks(csv)

    expect(errors).toHaveLength(0)
    
    // Check that all special tracks are in the imported tracks (order-agnostic)
    expect(importedTracks).toHaveLength(specialTracks.length)
    specialTracks.forEach(track => {
      expect(importedTracks).toContainEqual(track)
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
      [libraryPath]: [],
    })

    for (const track of tracksWithTags) {
      await addTrackToLibrary(track)
      mocks.getMetadata.mockResolvedValue({
        [libraryPath]: getLibrary(),
      })
    }

    const csv = TracksToCsv(getLibrary())
    const { tracks: importedTracks, errors } = csvToTracks(csv)

    expect(errors).toHaveLength(0)
    expect(importedTracks).toHaveLength(tracksWithTags.length)

    // Verify each track can be found with correct tags
    for (const track of tracksWithTags) {
      const importedTrack = importedTracks.find(
        t =>
          t.title === track.title &&
          t.url === track.url &&
          t.tags.length === track.tags.length &&
          t.tags.every(tag => track.tags.includes(tag)),
      )
      expect(importedTrack).toBeDefined()
      expect(importedTrack?.tags).toEqual(track.tags)
    }
  })
})
