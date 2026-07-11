import { beforeEach, describe, expect, it, vi } from "vitest"
import { Action } from "../domain/playback"
import { Track } from "../domain/track"

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

vi.mock("../infra/metadataHelper", () => ({
  updateMetadata: mocks.updateMetadata,
  updateMetadataWithCurrent: mocks.updateMetadataWithCurrent,
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
  clearRoomLibrary,
  deleteTrackFromRoomLibrary,
  mergeTracksIntoRoomLibrary,
  writeControlAndProgress,
  writeLibrary,
  writeLibraryAndProgress,
  writeLibraryAndProgressAndClearControl,
} from "../room/stateOperations"
import { controlPath, libraryPath, progressPath } from "../room/metadataSchema"

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
  it("writes control and progress for playback updates", async () => {
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

    const progress = {
      "https://example.com/track.mp3": 5,
    }

    await writeControlAndProgress(control, progress)

    expect(mocks.updateMetadata).toHaveBeenCalledWith({
      [controlPath]: control,
      [progressPath]: progress,
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

    const progress = {
      "https://example.com/track.mp3": 9,
    }

    await writeLibraryAndProgress(library, progress)

    expect(mocks.updateMetadata).toHaveBeenCalledWith({
      [libraryPath]: library,
      [progressPath]: progress,
    })

    await writeLibraryAndProgressAndClearControl(library, progress)

    expect(mocks.updateMetadata).toHaveBeenCalledWith({
      [libraryPath]: library,
      [progressPath]: progress,
      [controlPath]: undefined,
    })

    await clearControlAndWriteProgress(progress)

    expect(mocks.updateMetadata).toHaveBeenCalledWith({
      [controlPath]: undefined,
      [progressPath]: progress,
    })
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
      },
    ])
    expect(mocks.metadata[libraryPath]).toEqual(outcome.library)
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
    mocks.metadata = {
      [libraryPath]: [baseTrack],
      [progressPath]: {
        [baseTrack.url]: 22,
      },
      [controlPath]: {
        id: "m1",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 2,
        duration: 200,
        track: baseTrack,
      },
    }

    const outcome = await deleteTrackFromRoomLibrary(baseTrack)

    expect(outcome.changed).toBe(true)
    expect(outcome.shouldStopPlayback).toBe(true)
    expect(outcome.library).toEqual([])
    expect(outcome.progress).toEqual({})
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
})
