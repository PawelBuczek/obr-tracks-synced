import { beforeEach, describe, expect, it, vi } from "vitest"

const roomMocks = vi.hoisted(() => {
  const listeners = new Set<(metadata: Record<string, unknown>) => void>()
  const state = {
    metadata: {} as Record<string, unknown>,
  }

  return {
    listeners,
    state,
    getMetadata: vi.fn(() => Promise.resolve(state.metadata)),
    onMetadataChange: vi.fn(
      (handler?: (metadata: Record<string, unknown>) => void) => {
        if (handler) {
          listeners.add(handler)
        }

        return () => {
          if (handler) {
            listeners.delete(handler)
          }
        }
      },
    ),
    setMetadata: vi.fn((metadata: Record<string, unknown>) => {
      state.metadata = metadata
      listeners.forEach(handler => handler(metadata))
    }),
    updateMetadata: vi.fn(),
    updateMetadataWithCurrent: vi.fn(),
  }
})

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    room: {
      getMetadata: roomMocks.getMetadata,
      setMetadata: roomMocks.setMetadata,
      onMetadataChange: roomMocks.onMetadataChange,
    },
    notification: {
      show: vi.fn(),
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
  updateMetadata: roomMocks.updateMetadata,
  updateMetadataWithCurrent: roomMocks.updateMetadataWithCurrent,
}))

import type { Message } from "../../room/mb"
import { Action } from "../../room/mb"
import { controlPath, libraryPath, progressPath } from "../../room/metadataSchema"

type Client = {
  name: string
  messages: Message[]
  unsubscribe: () => void
}

async function flushMicrotasks() {
  await Promise.resolve()
  await Promise.resolve()
}

async function createClient(name: string): Promise<Client> {
  vi.resetModules()

  const { onMessage } = await import("../../room/mb")

  const messages: Message[] = []
  const unsubscribe = onMessage(message => {
    messages.push(message)
  })

  await flushMicrotasks()

  return {
    name,
    messages,
    unsubscribe,
  }
}

async function createRecoveryClient() {
  vi.resetModules()

  const { onMessage, pause } = await import("../../room/mb")

  const messages: Message[] = []
  const unsubscribe = onMessage(message => {
    messages.push(message)
  })

  await flushMicrotasks()

  return {
    messages,
    pause,
    unsubscribe,
  }
}

describe("multi-client room sync simulation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    roomMocks.listeners.clear()
    roomMocks.state.metadata = {}

    roomMocks.updateMetadata.mockImplementation((update: Record<string, unknown>) => {
      roomMocks.setMetadata({
        ...roomMocks.state.metadata,
        ...update,
      })
    })

    roomMocks.updateMetadataWithCurrent.mockImplementation(async (transform) => {
      const update = await transform(roomMocks.state.metadata)

      if (!update) {
        return
      }

      roomMocks.setMetadata({
        ...roomMocks.state.metadata,
        ...update,
      })
    })
  })

  it("keeps four clients in sync and gives a late joiner the current playback state", async () => {
    const trackOne = {
      title: "Shared Track One",
      url: "https://www.dropbox.com/scl/fi/example/track-one.mp3?dl=0",
      tags: ["ambient"],
    }
    const trackTwo = {
      title: "Shared Track Two",
      url: "https://www.dropbox.com/scl/fi/example/track-two.mp3?dl=0",
      tags: ["battle"],
    }

    roomMocks.state.metadata = {
      [libraryPath]: [trackOne, trackTwo],
      [progressPath]: {
        [trackOne.url]: 12,
        [trackTwo.url]: 0,
      },
      [controlPath]: {
        id: "gm-1-play",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 12,
        duration: 180,
        track: trackOne,
      },
    }

    const clients: Client[] = []
    for (const name of ["gm-1", "gm-2", "player-1", "player-2"]) {
      clients.push(await createClient(name))
    }

    await flushMicrotasks()

    clients.forEach(client => {
      expect(client.messages).toHaveLength(1)
      expect(client.messages[0]).toMatchObject({
        id: "gm-1-play",
        action: Action.Play,
        offset: 12,
        duration: 180,
        track: {
          title: trackOne.title,
          url: trackOne.url,
          tags: trackOne.tags,
        },
      })
    })

    roomMocks.setMetadata({
      [libraryPath]: [trackOne, trackTwo],
      [progressPath]: {
        [trackOne.url]: 45,
        [trackTwo.url]: 0,
      },
      [controlPath]: {
        id: "gm-2-play",
        time: new Date("2026-01-01T00:00:30.000Z").toISOString(),
        action: Action.Play,
        offset: 45,
        duration: 180,
        track: trackTwo,
      },
    })

    await flushMicrotasks()

    clients.forEach(client => {
      expect(client.messages).toHaveLength(2)
      expect(client.messages[1]).toMatchObject({
        id: "gm-2-play",
        action: Action.Play,
        offset: 45,
        duration: 180,
        track: {
          title: trackTwo.title,
          url: trackTwo.url,
          tags: trackTwo.tags,
        },
      })
    })

    const lateJoiner = await createClient("player-3")

    await flushMicrotasks()

    expect(lateJoiner.messages).toHaveLength(1)
    expect(lateJoiner.messages[0]).toMatchObject({
      id: "gm-2-play",
      action: Action.Play,
      offset: 45,
      duration: 180,
      track: {
        title: trackTwo.title,
        url: trackTwo.url,
        tags: trackTwo.tags,
      },
    })

    clients.forEach(client => client.unsubscribe())
    lateJoiner.unsubscribe()
  })

  it("lets a late joiner recover the current playback state and pause from it", async () => {
    const track = {
      title: "Recovery Track",
      url: "https://www.dropbox.com/scl/fi/example/recovery.mp3?dl=0",
      tags: ["ambient"],
    }

    roomMocks.state.metadata = {
      [libraryPath]: [track],
      [progressPath]: {
        [track.url]: 14,
      },
      [controlPath]: {
        id: "gm-play",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 14,
        duration: 120,
        track,
      },
    }

    const lateJoiner = await createRecoveryClient()

    expect(lateJoiner.messages).toHaveLength(1)
    expect(lateJoiner.messages[0]).toMatchObject({
      id: "gm-play",
      action: Action.Play,
      offset: 14,
      duration: 120,
      track,
    })

    lateJoiner.pause()

    await flushMicrotasks()

    expect(lateJoiner.messages).toHaveLength(2)
    expect(lateJoiner.messages[1]).toMatchObject({
      action: Action.Pause,
      duration: 120,
      track,
    })
    expect(roomMocks.state.metadata[controlPath]).toMatchObject({
      action: Action.Pause,
      duration: 120,
      track,
    })

    lateJoiner.unsubscribe()
  })

  it("reloads to the latest playback state after reconnecting", async () => {
    const firstTrack = {
      title: "First Track",
      url: "https://www.dropbox.com/scl/fi/example/first.mp3?dl=0",
      tags: ["ambient"],
    }
    const secondTrack = {
      title: "Second Track",
      url: "https://www.dropbox.com/scl/fi/example/second.mp3?dl=0",
      tags: ["battle"],
    }

    roomMocks.state.metadata = {
      [libraryPath]: [firstTrack, secondTrack],
      [progressPath]: {
        [firstTrack.url]: 19,
        [secondTrack.url]: 0,
      },
      [controlPath]: {
        id: "gm-first-play",
        time: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        action: Action.Play,
        offset: 19,
        duration: 150,
        track: firstTrack,
      },
    }

    const initialClient = await createClient("player-reload")

    expect(initialClient.messages).toHaveLength(1)
    expect(initialClient.messages[0]).toMatchObject({
      id: "gm-first-play",
      action: Action.Play,
      offset: 19,
      duration: 150,
      track: firstTrack,
    })

    initialClient.unsubscribe()

    roomMocks.setMetadata({
      [libraryPath]: [firstTrack, secondTrack],
      [progressPath]: {
        [firstTrack.url]: 19,
        [secondTrack.url]: 31,
      },
      [controlPath]: {
        id: "gm-second-play",
        time: new Date("2026-01-01T00:00:45.000Z").toISOString(),
        action: Action.Play,
        offset: 31,
        duration: 150,
        track: secondTrack,
      },
    })

    const reloadedClient = await createClient("player-reload")

    await flushMicrotasks()

    expect(reloadedClient.messages).toHaveLength(1)
    expect(reloadedClient.messages[0]).toMatchObject({
      id: "gm-second-play",
      action: Action.Play,
      offset: 31,
      duration: 150,
      track: secondTrack,
    })

    reloadedClient.unsubscribe()
  })
})