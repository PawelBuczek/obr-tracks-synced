import { beforeEach, describe, expect, it, vi } from "vitest"
import { Action } from "../../domain/playback"
import { Track } from "../../domain/track"

const mocks = vi.hoisted(() => ({
  metadata: {} as Record<string, unknown>,
  updateMetadata: vi.fn(),
  updateMetadataWithCurrent: vi.fn(),
  setMetadata: vi.fn((metadata: Record<string, unknown>) => {
    mocks.metadata = metadata
  }),
  resetMetadata: () => {
    mocks.metadata = {}
  },
}))

vi.mock("../../infra/metadataHelper", () => ({
  updateMetadata: mocks.updateMetadata,
  updateMetadataWithCurrent: mocks.updateMetadataWithCurrent,
  getMetadataSize: vi.fn(() => Promise.resolve(JSON.stringify(mocks.metadata).length)),
}))

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    notification: {
      show: vi.fn(),
    },
  },
}))

import {
  clearControlAndWriteProgress,
  writeControlAndProgress,
} from "../../room/state/playbackWrites"
import {
  writeLibrary,
  writeLibraryAndProgress,
  writeLibraryAndProgressAndClearControl,
} from "../../room/state/libraryWrites"
import {
  clearRoomLibrary,
  deleteTrackFromRoomLibrary,
  mergeTracksIntoRoomLibrary,
  moveTrackInRoomLibrary,
} from "../../room/state/libraryMutations"
import {
  controlPath,
  libraryPath,
  progressPath,
} from "../../room/metadataSchema"

const baseTrack: Track = {
  title: "Track",
  url: "https://example.com/track.mp3",
  tags: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resetMetadata()

  mocks.updateMetadata.mockImplementation((update: Record<string, unknown>) => {
    mocks.setMetadata({
      ...mocks.metadata,
      ...update,
    })
  })

  mocks.updateMetadataWithCurrent.mockImplementation(async (transform) => {
    const update = await transform(mocks.metadata)
    if (update) {
      mocks.setMetadata({
        ...mocks.metadata,
        ...update,
      })
    }
  })
})

describe("room state operations", () => {
  it("writes control and stores the paused offset on the library row instead of a standalone progress map", async () => {
    const control = {
      id: "msg-1",
      time: new Date("2026-01-01T00:00:00.000Z"),
      action: Action.Pause,
      offset: 5,
      duration: 60,
      track: {
        title: "Track",
        url: "https://example.com/track.mp3",
        tags: [],
      },
    }

    mocks.metadata = {
      [libraryPath]: [{ ...control.track, offset: 0 }],
      [progressPath]: {},
    }

    await writeControlAndProgress(control)

    expect(mocks.updateMetadataWithCurrent).toHaveBeenCalled()
    expect(mocks.metadata[controlPath]).toEqual(control)
    expect(mocks.metadata[progressPath]).toBeUndefined()
    expect(mocks.metadata[libraryPath]).toEqual([
      { ...control.track, offset: 5 },
    ])
  })

  it("no-ops playback write when track is no longer in room library", async () => {
    const control = {
      id: "msg-1",
      time: new Date("2026-01-01T00:00:00.000Z"),
      action: Action.Play,
      offset: 5,
      duration: 60,
      track: {
        title: "Track",
        url: "https://example.com/track.mp3",
        tags: [],
      },
    }

    mocks.metadata = {
      [libraryPath]: [],
      [progressPath]: {},
    }

    await writeControlAndProgress(control)

    expect(mocks.metadata[controlPath]).toBeUndefined()
    expect(mocks.metadata[progressPath]).toEqual({})
  })

  it("no-ops playback write when current control id changed", async () => {
    const control = {
      id: "msg-next",
      time: new Date("2026-01-01T00:00:00.000Z"),
      action: Action.Pause,
      offset: 7,
      duration: 60,
      track: {
        title: "Track",
        url: "https://example.com/track.mp3",
        tags: [],
      },
    }

    mocks.metadata = {
      [libraryPath]: [control.track],
      [controlPath]: {
        ...control,
        id: "msg-current",
        action: Action.Play,
      },
      [progressPath]: {
        "https://example.com/track.mp3": 3,
      },
    }

    await writeControlAndProgress(control, {
      expectedControlId: "msg-old",
    })

    expect(mocks.metadata[controlPath]).toEqual(
      expect.objectContaining({
        id: "msg-current",
      }),
    )
    expect(mocks.metadata[progressPath]).toEqual({
      "https://example.com/track.mp3": 3,
    })
  })

  it("writes library metadata", async () => {
    const library = [
      {
        title: "Track",
        url: "https://example.com/track.mp3",
        tags: ["ambient"],
      },
    ]

    await writeLibrary(library)

    expect(mocks.updateMetadata).toHaveBeenCalledWith({
      [libraryPath]: library,
    })
  })

  it("writes library and progress and clears control", async () => {
    const library = [
      {
        title: "Track",
        url: "https://example.com/track.mp3",
        tags: [],
      },
    ]

    await writeLibraryAndProgress(library)

    expect(mocks.updateMetadata).toHaveBeenCalledWith({
      [libraryPath]: library,
      [progressPath]: undefined,
    })

    await writeLibraryAndProgressAndClearControl(library)

    expect(mocks.updateMetadata).toHaveBeenCalledWith({
      [libraryPath]: library,
      [controlPath]: undefined,
      [progressPath]: undefined,
    })

    await clearControlAndWriteProgress()

    expect(mocks.updateMetadataWithCurrent).toHaveBeenCalled()
    expect(mocks.metadata[controlPath]).toBeUndefined()
    expect(mocks.metadata[progressPath]).toBeUndefined()
  })

  it("merges tracks into room library using current metadata snapshot", async () => {
    mocks.metadata = {
      [libraryPath]: [
        {
          title: "Old",
          url: baseTrack.url,
          tags: ["one"],
        },
      ],
      [progressPath]: {
        [baseTrack.url]: 12,
      },
    }

    const outcome = await mergeTracksIntoRoomLibrary([
      {
        title: "New",
        url: baseTrack.url,
        tags: ["two"],
      },
    ])

    expect(outcome.changed).toBe(true)
    expect(outcome.library).toEqual([
      {
        title: "New",
        url: baseTrack.url,
        tags: ["two"],
        offset: 0,
      },
    ])
    expect(mocks.metadata[libraryPath]).toEqual(outcome.library)
  })

  it("adds valid tracks and reports tracks with URLs over 200 characters", async () => {
    const tracks = Array.from({ length: 30 }, (_, index) => ({
      title: `Track ${index + 1}`,
      url:
        index < 13
          ? ` HTTPS://EXAMPLE.COM/${"a".repeat(190)}-${index}.mp3 `
          : ` HTTPS://EXAMPLE.COM/track-${index + 1}.mp3 `,
      tags: [],
    }))

    const outcome = await mergeTracksIntoRoomLibrary(tracks)

    expect(outcome.library).toHaveLength(17)
    expect(outcome.library.map(track => track.title)).toEqual(
      tracks.slice(13).map(track => `Track ${tracks.indexOf(track) + 1}`),
    )
    expect(outcome.rejections).toEqual([
      { reason: "url-too-long", count: 13 },
    ])
    expect(mocks.metadata[libraryPath]).toEqual(outcome.library)
  })

  it("treats dropbox url variants as one track during merge updates", async () => {
    const shareUrl = "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0"
    const directUrl = "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1"

    mocks.metadata = {
      [libraryPath]: [
        {
          title: "Old Title",
          url: shareUrl,
          tags: ["old"],
        },
      ],
      [progressPath]: {
        [directUrl]: 9,
      },
    }

    const outcome = await mergeTracksIntoRoomLibrary([
      {
        title: "New Title",
        url: directUrl,
        tags: ["new"],
      },
    ])

    expect(outcome.changed).toBe(true)
    expect(outcome.library).toEqual([
      {
        title: "New Title",
        url: directUrl,
        tags: ["new"],
        offset: 0,
      },
    ])
    expect(mocks.metadata[libraryPath]).toEqual(outcome.library)
  })

  it("refreshes currently playing control track title and tags when merging same-url track", async () => {
    const playingTrack = {
      title: "Old Title",
      url: "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1",
      tags: ["old"],
    }

    mocks.metadata = {
      [libraryPath]: [
        {
          title: "Old Title",
          url: "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0",
          tags: ["old"],
        },
      ],
      [progressPath]: {
        [playingTrack.url]: 12,
      },
      [controlPath]: {
        id: "m1",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 2,
        duration: 200,
        track: playingTrack,
      },
    }

    const outcome = await mergeTracksIntoRoomLibrary([
      {
        title: "Updated Title",
        url: "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0",
        tags: ["updated", "focus"],
      },
    ])

    expect(outcome.changed).toBe(true)
    expect(mocks.metadata[controlPath]).toEqual(
      expect.objectContaining({
        track: {
          title: "Updated Title",
          url: playingTrack.url,
          tags: ["updated", 3],
        },
      }),
    )
  })

  it("no-ops delete when target track is already absent", async () => {
    mocks.metadata = {
      [libraryPath]: [],
      [progressPath]: {},
    }

    const outcome = await deleteTrackFromRoomLibrary(baseTrack)

    expect(outcome.changed).toBe(false)
    expect(outcome.shouldStopPlayback).toBe(false)
  })

  it("deleting currently playing track clears control and removes progress", async () => {
    const playingTrack = {
      ...baseTrack,
      url: "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1",
    }

    const libraryTrack = {
      ...baseTrack,
      url: "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0",
    }

    mocks.metadata = {
      [libraryPath]: [libraryTrack],
      [progressPath]: {
        [playingTrack.url]: 22,
      },
      [controlPath]: {
        id: "m1",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 2,
        duration: 200,
        track: playingTrack,
      },
    }

    const outcome = await deleteTrackFromRoomLibrary(libraryTrack)

    expect(outcome.changed).toBe(true)
    expect(outcome.shouldStopPlayback).toBe(true)
    expect(outcome.library).toEqual([])
    expect(mocks.metadata[libraryPath]).toEqual([])
    expect(mocks.metadata[controlPath]).toBeUndefined()
  })

  it("clear room library no-ops on already empty state", async () => {
    mocks.metadata = {
      [libraryPath]: [],
      [progressPath]: {},
    }

    const outcome = await clearRoomLibrary()

    expect(outcome.changed).toBe(false)
    expect(outcome.shouldStopPlayback).toBe(false)
  })

  it("keeps insertion order for merged tracks and preserves existing array order when updating same-url tracks", async () => {
    const first = {
      title: "First",
      url: "https://example.com/first.mp3",
      tags: [],
    }
    const second = {
      title: "Second",
      url: "https://example.com/second.mp3",
      tags: [],
    }

    mocks.metadata = {
      [libraryPath]: [],
      [progressPath]: {},
    }

    await mergeTracksIntoRoomLibrary([first, second])

    expect(mocks.metadata[libraryPath]).toEqual([
      { ...first, offset: 0 },
      { ...second, offset: 0 },
    ])

    const updatedFirst = {
      ...first,
      title: "First Updated",
      tags: ["focus"],
    }

    await mergeTracksIntoRoomLibrary([updatedFirst])

    expect(mocks.metadata[libraryPath]).toEqual([
      { ...updatedFirst, tags: [3], offset: 0 },
      { ...second, offset: 0 },
    ])
  })

  it("removes the target track from the library array without keeping a sidecar order map", async () => {
    const first = {
      title: "First",
      url: "https://example.com/first.mp3",
      tags: [],
    }
    const second = {
      title: "Second",
      url: "https://example.com/second.mp3",
      tags: [],
    }
    const third = {
      title: "Third",
      url: "https://example.com/third.mp3",
      tags: [],
    }

    mocks.metadata = {
      [libraryPath]: [first, second, third],
      [progressPath]: {},
    }

    await deleteTrackFromRoomLibrary(second)

    expect(mocks.metadata[libraryPath]).toEqual([
      { ...first, offset: 0 },
      { ...third, offset: 0 },
    ])
  })

  it("moves tracks by swapping adjacent entries in the library array", async () => {
    const first = {
      title: "First",
      url: "https://example.com/first.mp3",
      tags: [],
    }
    const second = {
      title: "Second",
      url: "https://example.com/second.mp3",
      tags: [],
    }
    const third = {
      title: "Third",
      url: "https://example.com/third.mp3",
      tags: [],
    }

    mocks.metadata = {
      [libraryPath]: [first, second, third],
      [progressPath]: {},
    }

    const moveUp = await moveTrackInRoomLibrary(second, "up")
    expect(moveUp.changed).toBe(true)
    expect(moveUp.library).toEqual([
      { ...second, offset: 0 },
      { ...first, offset: 0 },
      { ...third, offset: 0 },
    ])

    const moveDown = await moveTrackInRoomLibrary(second, "down")
    expect(moveDown.changed).toBe(true)
    expect(moveDown.library).toEqual([
      { ...first, offset: 0 },
      { ...second, offset: 0 },
      { ...third, offset: 0 },
    ])
  })

})
