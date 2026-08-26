import { describe, expect, it } from "vitest"
import {
  Action,
  getPlaybackOffset,
  getTrackInteractionAction,
} from "../../domain/playback"
import { isSameTrack, Track } from "../../domain/track"
import { getTrackListClickAction } from "../../domain/trackListActions"

describe("prepareTrackSelection", () => {
  it("wraps playback progress back to the start once elapsed time exceeds the track duration", () => {
    const offset = 8
    const elapsedSeconds = 4
    const duration = 10

    const progress = (offset + elapsedSeconds) % duration

    expect(progress).toBe(2)
  })

  it("toggles pause and resume when the clicked track is already active", () => {
    const track: Track = {
      title: "Active Track",
      url: "https://example.com/active.mp3",
      tags: [],
    }

    expect(getTrackInteractionAction(track, track, Action.Play)).toBe("pause")
    expect(getTrackInteractionAction(track, track, Action.Pause)).toBe("resume")
    expect(
      getTrackInteractionAction(
        track,
        { ...track, url: "https://example.com/other.mp3" },
        Action.Play,
      ),
    ).toBe("play")
  })

  it("preserves the elapsed offset when pausing and resuming", () => {
    const offset = 12
    const startedAt = new Date("2024-01-01T00:00:00.000Z")
    const now = new Date("2024-01-01T00:00:10.000Z")

    expect(getPlaybackOffset(offset, startedAt, now)).toBe(22)
  })

  it("routes the track-list click to pause, resume, or play based on the active track", () => {
    const track: Track = {
      title: "List Track",
      url: "https://example.com/list.mp3",
      tags: [],
    }

    expect(getTrackListClickAction(track, undefined)).toBe("play")
    expect(
      getTrackListClickAction(track, { track, action: Action.Play }),
    ).toBe("pause")
    expect(
      getTrackListClickAction(track, { track, action: Action.Pause }),
    ).toBe("resume")
  })

  it("treats the same track as active even when the playback message uses a rewritten download URL", () => {
    const track: Track = {
      title: "Dropbox Track",
      url: "https://www.dropbox.com/s/example/file.mp3?dl=0",
      tags: [],
    }

    const rewrittenTrack: Track = {
      ...track,
      url: "https://dl.dropboxusercontent.com/s/example/file.mp3?dl=1",
    }

    expect(getTrackListClickAction(track, { track: rewrittenTrack, action: Action.Play })).toBe("pause")
    expect(isSameTrack(track, rewrittenTrack)).toBe(true)
  })
})
