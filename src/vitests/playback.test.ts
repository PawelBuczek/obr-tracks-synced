import { describe, expect, it } from "vitest"
import {
  Action,
  getPlaybackOffset,
  getTrackInteractionAction,
  prepareTrackSelection,
  removeTrackProgress,
  resetTrackProgress,
} from "../playback"
import { isSameTrack, Track } from "../track"
import { getTrackListClickAction } from "../trackListActions"

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

  it("does not save progress when switching away from a paused track", () => {
    const currentTrack: Track = {
      title: "Paused Track",
      url: "https://example.com/paused.mp3",
      tags: [],
    }
    const nextTrack: Track = {
      title: "Next Track",
      url: "https://example.com/next.mp3",
      tags: [],
    }

    const result = prepareTrackSelection(nextTrack, {}, currentTrack, 33, Action.Pause)

    expect(result.progressMap).toEqual({})
    expect(result.offset).toBe(0)
  })

  it("removes progress entries for a deleted track without affecting other tracks", () => {
    const deletedTrack: Track = {
      title: "Deleted Track",
      url: "https://example.com/deleted.mp3",
      tags: [],
    }

    const result = removeTrackProgress(
      {
        [deletedTrack.url]: 42,
        "https://example.com/other.mp3": 99,
      },
      deletedTrack,
    )

    expect(result).toEqual({
      "https://example.com/other.mp3": 99,
    })
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
