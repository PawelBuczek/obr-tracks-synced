import { render, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Action } from "../../room/mb"
import { Audio } from "../../ui/player/Audio"

vi.mock("../../ui/providers/MessageProvider", () => ({
  useMessage: vi.fn(),
}))

import { useMessage } from "../../ui/providers/MessageProvider"

describe("Audio looping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("keeps audio configured to loop and wraps playback time when the track has run past its duration", async () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "loop-1",
      time: new Date("2026-01-01T00:00:00.000Z"),
      action: Action.Play,
      offset: 95,
      duration: 100,
      track: {
        title: "Loop Track",
        url: "https://example.com/loop.mp3",
        tags: [],
      },
    })

    render(<Audio ready={true} volume={0.5} mute={false} />)

    const audio = document.getElementById("tracks-audio-player") as HTMLAudioElement

    await waitFor(() => {
      expect(audio).toBeDefined()
      expect(audio.loop).toBe(true)
      expect(audio.currentTime).toBeGreaterThanOrEqual(0)
      expect(audio.currentTime).toBeLessThan(100)
    })
  })

  it("does not assign NaN to currentTime when an optimistic play message has zero duration", async () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "optimistic-play",
      time: new Date(),
      action: Action.Play,
      offset: 0,
      duration: 0,
      track: {
        title: "Fresh Track",
        url: "https://example.com/fresh.mp3",
        tags: [],
      },
    })

    render(<Audio ready={true} volume={0.5} mute={false} />)

    const audio = document.getElementById("tracks-audio-player") as HTMLAudioElement

    await waitFor(() => {
      expect(audio).toBeDefined()
      expect(Number.isFinite(audio.currentTime)).toBe(true)
      expect(audio.currentTime).toBeGreaterThanOrEqual(0)
    })
  })

  it("retries play in muted mode when autoplay blocks unmuted playback on rejoin", async () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "rejoin-play",
      time: new Date(),
      action: Action.Play,
      offset: 10,
      duration: 120,
      track: {
        title: "Rejoin Track",
        url: "https://example.com/rejoin.mp3",
        tags: [],
      },
    })

    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValueOnce(new Error("autoplay blocked"))
      .mockResolvedValueOnce(undefined)

    render(<Audio ready={true} volume={0.5} mute={false} />)

    const audio = document.getElementById("tracks-audio-player") as HTMLAudioElement

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledTimes(2)
      expect(audio.muted).toBe(false)
    })

    playMock.mockRestore()
  })
})