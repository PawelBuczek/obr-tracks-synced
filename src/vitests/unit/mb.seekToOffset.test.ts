import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  metadata: {} as Record<string, unknown>,
  role: "GM" as "GM" | "PLAYER",
  getMetadata: vi.fn(() => Promise.resolve(mocks.metadata)),
  onMetadataChange: vi.fn(
    (_handler?: (metadata: Record<string, unknown>) => void) => vi.fn(),
  ),
  getRole: vi.fn(() => Promise.resolve(mocks.role)),
  writeControlAndProgress: vi.fn(),
  logEvent: vi.fn(),
}))

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    room: {
      getMetadata: mocks.getMetadata,
      onMetadataChange: mocks.onMetadataChange,
    },
    player: {
      getRole: mocks.getRole,
    },
    notification: {
      show: vi.fn(),
    },
  },
}))

vi.mock("firebase/analytics", () => ({
  logEvent: mocks.logEvent,
  setConsent: vi.fn(),
  getAnalytics: vi.fn(() => ({})),
}))

vi.mock("../../infra/firebase", () => ({
  analytics: {},
}))

vi.mock("../../room/stateOperations", async () => {
  const actual = await vi.importActual("../../room/stateOperations")
  return {
    ...actual,
    writeControlAndProgress: mocks.writeControlAndProgress,
  }
})

import { Action, controlPath, onMessage, seekToOffset } from "../../room/mb"
import { progressPath } from "../../room/metadataSchema"

describe("seekToOffset authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.role = "GM"
    mocks.metadata = {
      [controlPath]: {
        id: "message-1",
        time: new Date("2026-01-01T00:00:00Z").toISOString(),
        action: Action.Play,
        offset: 10,
        duration: 120,
        track: {
          title: "Test Track",
          url: "https://example.com/test.mp3",
          tags: [],
        },
      },
      [progressPath]: {
        "https://example.com/test.mp3": 10,
      },
    }
  })

  it("allows GM users to seek", async () => {
    onMessage(() => undefined)
    await Promise.resolve()

    await seekToOffset(30)

    expect(mocks.getRole).toHaveBeenCalled()
    expect(mocks.writeControlAndProgress).toHaveBeenCalledTimes(1)
  })

  it("rejects non-GM users from seeking", async () => {
    mocks.role = "PLAYER"

    onMessage(() => undefined)
    await Promise.resolve()

    await expect(seekToOffset(30)).rejects.toThrow(
      "Only the GM can change track progress",
    )

    expect(mocks.getRole).toHaveBeenCalled()
    expect(mocks.writeControlAndProgress).not.toHaveBeenCalled()
  })
})
