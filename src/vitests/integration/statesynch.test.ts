import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(() => Promise.resolve({})),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(
    (_handler?: (metadata: Record<string, unknown>) => void) => vi.fn(),
  ),
  updateMetadata: vi.fn(),
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
}))

import { Action, controlPath, onMessage, pause, stop } from "../../room/mb"

describe("message state synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows pausing after receiving a play message", async () => {
    const callback = vi.fn()

    mocks.getMetadata.mockResolvedValue({
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
    })

    onMessage(callback)

    await Promise.resolve()

    expect(callback).toHaveBeenCalled()

    await pause()

    expect(mocks.updateMetadata).toHaveBeenCalled()
  })

  it("emits update when control message id is unchanged but track metadata changes", async () => {
    const callback = vi.fn()

    let metadata = {
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
    }

    mocks.getMetadata.mockImplementation(() => Promise.resolve(metadata))
    mocks.onMetadataChange.mockImplementation(
      (handler?: (metadata: Record<string, unknown>) => void) => {
      metadata = {
        [controlPath]: {
          ...metadata[controlPath],
          track: {
            title: "New",
            url: "https://example.com/test.mp3",
            tags: ["new"],
          },
        },
      }
      handler?.(metadata)
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

  mocks.getMetadata.mockResolvedValue({
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
  })

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
