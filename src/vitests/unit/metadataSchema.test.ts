import { describe, expect, it } from "vitest"
import { Action } from "../../domain/playback"
import {
  controlPath,
  extractControlMessage,
  extractLibrary,
  extractLibraryOrderMap,
  extractProgressMap,
  libraryPath,
  libraryOrderPath,
  progressPath,
  sortLibraryByOrder,
} from "../../room/metadataSchema"

describe("metadata schema", () => {
  it("extracts only valid tracks from library metadata", () => {
    const metadata = {
      [libraryPath]: [
        {
          title: "Valid",
          url: "https://example.com/ok.mp3",
          tags: ["ambience"],
        },
        {
          title: "",
          url: "   ",
          tags: ["bad"],
        },
        "bad-entry",
      ],
    }

    expect(extractLibrary(metadata)).toEqual([
      {
        title: "Valid",
        url: "https://example.com/ok.mp3",
        tags: ["ambience"],
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

  it("extracts library order map and ignores invalid values", () => {
    const metadata = {
      [libraryOrderPath]: {
        "https://example.com/first.mp3": 0,
        "https://example.com/second.mp3": 2,
        "https://example.com/bad.mp3": -1,
        "https://example.com/string.mp3": "3",
      },
    }

    expect(extractLibraryOrderMap(metadata)).toEqual({
      "https://example.com/first.mp3": 0,
      "https://example.com/second.mp3": 2,
    })
  })

  it("sorts library by ascending order", () => {
    const library = [
      {
        title: "Second",
        url: "https://example.com/second.mp3",
        tags: [],
      },
      {
        title: "First",
        url: "https://example.com/first.mp3",
        tags: [],
      },
    ]

    const sorted = sortLibraryByOrder(library, {
      "https://example.com/second.mp3": 1,
      "https://example.com/first.mp3": 0,
    })

    expect(sorted.map(track => track.title)).toEqual(["First", "Second"])
  })

  it("extracts a valid control message", () => {
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
          tags: [],
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
        tags: [],
      },
    })
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
