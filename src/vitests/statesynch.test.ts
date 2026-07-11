import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getMetadata: vi.fn(() => Promise.resolve({})),
  setMetadata: vi.fn(),
  onMetadataChange: vi.fn(() => vi.fn()),
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

vi.mock("../infra/firebase", () => ({
  analytics: {},
}))

vi.mock("../infra/metadataHelper", () => ({
  updateMetadata: mocks.updateMetadata,
}))

import { Action, controlPath, onMessage, pause, stop } from "../room/mb"

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
