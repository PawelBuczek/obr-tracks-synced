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
  broadcastSendMessage: vi.fn(() => Promise.resolve()),
  broadcastOnMessage: vi.fn(
    (_channel: string, _callback: (event: { data: unknown }) => void) =>
      vi.fn(),
  ),
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
    broadcast: {
      sendMessage: mocks.broadcastSendMessage,
      onMessage: mocks.broadcastOnMessage,
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

vi.mock("../../room/state/playbackWrites", async () => {
  const actual = await vi.importActual("../../room/state/playbackWrites")
  return {
    ...actual,
    writeControlAndProgress: mocks.writeControlAndProgress,
  }
})

import {
  Action,
  broadcastSeekPreview,
  controlPath,
  onMessage,
  onSeekPreview,
  seekToOffset,
} from "../../room/mb"
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

describe("seek preview broadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it("does not broadcast before a control message has been received", async () => {
    // mb.ts's currentMessage is module-scoped state shared across tests in this
    // file, so get a pristine module instance to verify the pre-first-message state.
    vi.resetModules()
    const freshMb = await import("../../room/mb")

    freshMb.broadcastSeekPreview(30)

    expect(mocks.broadcastSendMessage).not.toHaveBeenCalled()
  })

  it("broadcasts the canonicalized track url and offset once a message exists", async () => {
    onMessage(() => undefined)
    await Promise.resolve()

    broadcastSeekPreview(45)

    expect(mocks.broadcastSendMessage).toHaveBeenCalledWith(
      expect.any(String),
      { trackUrl: "https://example.com/test.mp3", offsetSeconds: 45 },
    )
  })

  it("forwards well-formed preview messages and ignores malformed ones", () => {
    const callback = vi.fn()
    onSeekPreview(callback)

    const handler = mocks.broadcastOnMessage.mock.calls[0][1]
    handler({ data: { trackUrl: "https://example.com/test.mp3", offsetSeconds: 12 } })
    handler({ data: { trackUrl: "https://example.com/test.mp3" } })
    handler({ data: "not-an-object" })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith({
      trackUrl: "https://example.com/test.mp3",
      offsetSeconds: 12,
    })
  })
})
