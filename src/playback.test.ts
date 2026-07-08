import { describe, expect, it } from "vitest"
import { Action, prepareTrackSelection } from "./playback"
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
})
