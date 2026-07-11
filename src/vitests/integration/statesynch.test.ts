import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  metadata: {} as Record<string, unknown>,
  getMetadata: vi.fn(() => Promise.resolve(mocks.metadata)),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(
    (_handler?: (metadata: Record<string, unknown>) => void) => vi.fn(),
  ),
  updateMetadata: vi.fn(),
  updateMetadataWithCurrent: vi.fn(),
}))

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    room: {
      getMetadata: mocks.getMetadata,
      setMetadata: mocks.setMetadata,
      onMetadataChange: mocks.onMetadataChange,
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

import { Action, controlPath, onMessage, pause, stop } from "../../room/mb"
import { libraryPath } from "../../room/metadataSchema"

describe("message state synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.metadata = {}

    mocks.updateMetadata.mockImplementation((update: Record<string, unknown>) => {
      mocks.metadata = {
        ...mocks.metadata,
        ...update,
      }
    })

    mocks.updateMetadataWithCurrent.mockImplementation(async (transform) => {
      const update = await transform(mocks.metadata)

      if (!update) {
        return
      }

      mocks.metadata = {
        ...mocks.metadata,
        ...update,
      }
    })
  })

  it("allows pausing after receiving a play message", async () => {
    const callback = vi.fn()

    mocks.metadata = {
      [controlPath]: {
        id: "123",
        time: new Date().toISOString(),
        action: Action.Play,
        offset: 0,
        duration: 100,
        track: {
          title: "Test",
          url: "test.mp3",
          tags: [],
        },
      },
      [libraryPath]: [
        {
          title: "Test",
          url: "test.mp3",
          tags: [],
        },
      ],
    }

    onMessage(callback)

    await Promise.resolve()

    expect(callback).toHaveBeenCalled()

    await pause()

    expect(mocks.updateMetadataWithCurrent).toHaveBeenCalled()
  })

  it("emits update when control message id is unchanged but track metadata changes", async () => {
    const callback = vi.fn()

    mocks.metadata = {
      [controlPath]: {
        id: "same-id",
        time: new Date().toISOString(),
        action: Action.Play,
        offset: 0,
        duration: 100,
        track: {
          title: "Old",
          url: "https://example.com/test.mp3",
          tags: ["old"],
        },
      },
      [libraryPath]: [
        {
          title: "Old",
          url: "https://example.com/test.mp3",
          tags: ["old"],
        },
      ],
    }

    mocks.onMetadataChange.mockImplementation(
      (handler?: (metadata: Record<string, unknown>) => void) => {
      mocks.metadata = {
        [controlPath]: {
          ...(mocks.metadata[controlPath] as Record<string, unknown>),
          track: {
            title: "New",
            url: "https://example.com/test.mp3",
            tags: ["new"],
          },
        },
        [libraryPath]: [
          {
            title: "New",
            url: "https://example.com/test.mp3",
            tags: ["new"],
          },
        ],
      }
      handler?.(mocks.metadata)
      return vi.fn()
      },
    )

    onMessage(callback)

    await Promise.resolve()

    expect(callback).toHaveBeenCalledTimes(2)
    expect(
      callback.mock.calls.some(
        ([message]) =>
          message?.id === "same-id" &&
          message?.track.title === "New" &&
          JSON.stringify(message?.track.tags) === JSON.stringify(["new"]),
      ),
    ).toBe(true)
  })
})

it("clears current message after stop", async () => {
  const callback = vi.fn()

  mocks.metadata = {
    [controlPath]: {
      id: "456",
      time: new Date().toISOString(),
      action: Action.Play,
      offset: 0,
      duration: 100,
      track: {
        title: "Test",
        url: "test.mp3",
        tags: [],
      },
    },
    [libraryPath]: [
      {
        title: "Test",
        url: "test.mp3",
        tags: [],
      },
    ],
  }

  onMessage(callback)

  await Promise.resolve()

  expect(callback).toHaveBeenCalled()

  stop()

  expect(mocks.updateMetadata).toHaveBeenCalledWith(
    expect.objectContaining({
      [controlPath]: undefined,
    }),
  )
})
