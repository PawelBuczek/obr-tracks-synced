import { describe, expect, it } from "vitest"
import { Action, prepareTrackSelection, resetTrackProgress } from "./playback"
import { Track } from "./track"

describe("prepareTrackSelection", () => {
  it("saves the current track progress when switching tracks and resumes the new one from its saved offset", () => {
    const firstTrack: Track = {
      title: "First Track",
      url: "https://example.com/first.mp3",
      tags: [],
    }
    const secondTrack: Track = {
      title: "Second Track",
      url: "https://example.com/second.mp3",
      tags: [],
    }

    const progressMap = { [firstTrack.url]: 42 }

    const result = prepareTrackSelection(
      secondTrack,
      progressMap,
      firstTrack,
      42,
      Action.Play,
    )

    expect(result.progressMap[firstTrack.url]).toBe(42)
    expect(result.offset).toBe(0)
  })

  it("resets the currently playing track progress when playback is stopped", () => {
    const track: Track = {
      title: "Reset Track",
      url: "https://example.com/reset.mp3",
      tags: [],
    }

    const progressMap = {
      [track.url]: 42,
      "https://example.com/other.mp3": 99,
    }

    const result = resetTrackProgress(progressMap, track)

    expect(result[track.url]).toBe(0)
    expect(result["https://example.com/other.mp3"]).toBe(99)
  })
})
