import { describe, expect, it } from "vitest"
import { Action } from "../../domain/playback"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  extractLibrarySortMode,
  extractProgressMap,
  LibrarySortMode,
  libraryPath,
  librarySortModePath,
  progressPath,
} from "../../room/metadataSchema"

describe("metadata schema", () => {
  it("extracts only valid numeric-tag tracks from library metadata", () => {
    const metadata = {
      [libraryPath]: [
        {
          title: "Valid",
          url: "https://example.com/ok.mp3",
          tags: [2, 7],
          offset: 12,
        },
        {
          title: "",
          url: "   ",
          tags: [99],
          offset: -1,
        },
        "bad-entry",
      ],
    }

    expect(extractLibrary(metadata)).toEqual([
      {
        title: "Valid",
        url: "https://example.com/ok.mp3",
        tags: [2, 7],
        offset: 12,
      },
    ])
  })

  it("extracts progress map and ignores invalid offsets", () => {
    const metadata = {
      [progressPath]: {
        "https://example.com/ok.mp3": 12,
        "https://example.com/negative.mp3": -5,
        "https://example.com/string.mp3": "10",
      },
    }

    expect(extractProgressMap(metadata)).toEqual({
      "https://example.com/ok.mp3": 12,
    })
  })

  it("keeps the library array order as the canonical ordering", () => {
    const metadata = {
      [libraryPath]: [
        {
          title: "First",
          url: "https://example.com/first.mp3",
          tags: [],
        },
        {
          title: "Second",
          url: "https://example.com/second.mp3",
          tags: [],
        },
      ],
    }

    expect(extractLibrary(metadata).map(track => track.title)).toEqual([
      "First",
      "Second",
    ])
  })

  it("extracts persisted library sort mode with not-sorted fallback", () => {
    expect(extractLibrarySortMode({})).toEqual(LibrarySortMode.NotSorted)

    expect(
      extractLibrarySortMode({
        [librarySortModePath]: LibrarySortMode.Ascending,
      }),
    ).toEqual(LibrarySortMode.Ascending)

    expect(
      extractLibrarySortMode({
        [librarySortModePath]: LibrarySortMode.Descending,
      }),
    ).toEqual(LibrarySortMode.Descending)
  })

  it("extracts a valid control message without a track offset", () => {
    const metadata = {
      [controlPath]: {
        id: "abc",
        time: "2026-01-01T00:00:00.000Z",
        action: Action.Play,
        offset: 3,
        duration: 120,
        track: {
          title: "Valid",
          url: "https://example.com/ok.mp3",
          tags: [2, 5],
          offset: 7,
        },
      },
    }

    const message = extractControlMessage(metadata)

    expect(message).toMatchObject({
      id: "abc",
      action: Action.Play,
      offset: 3,
      duration: 120,
      track: {
        title: "Valid",
        url: "https://example.com/ok.mp3",
        tags: [2, 5],
      },
    })
    expect("offset" in (message?.track ?? {})).toBe(false)
    expect(message?.time instanceof Date).toBe(true)
  })

  it("returns undefined for malformed control message", () => {
    const metadata = {
      [controlPath]: {
        id: "abc",
        time: "invalid-date",
        action: Action.Play,
        offset: 3,
        duration: 120,
        track: {
          title: "Valid",
          url: "https://example.com/ok.mp3",
          tags: [],
        },
      },
    }

    expect(extractControlMessage(metadata)).toBeUndefined()
  })
})
