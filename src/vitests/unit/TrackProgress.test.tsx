import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { TrackProgress } from "../../ui/player/TrackProgress"
import { canonicalizeTrackUrl } from "../../domain/track"
import { Action, type Message, type SeekPreviewMessage } from "../../room/mb"

const mocks = vi.hoisted(() => ({
  seekToOffset: vi.fn(),
  broadcastSeekPreview: vi.fn(),
  onSeekPreview: vi.fn<(callback: (message: SeekPreviewMessage) => void) => () => void>(),
  useRole: vi.fn(),
  useMessage: vi.fn<() => Message | undefined>(() => undefined),
}))

vi.mock("@mui/material", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
  Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Typography: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useTheme: () => ({ palette: { grey: { 400: "#999" } } }),
  Slider: (props: {
    value: number
    disabled?: boolean
    onChange?: (event: Event, value: number | number[]) => void
    onChangeCommitted?: (
      event: Event | React.SyntheticEvent,
      value: number | number[],
    ) => void
    onMouseDown?: () => void
  }) => (
    <div data-testid="slider-root" onMouseDown={props.onMouseDown}>
      <span data-testid="slider-value">{String(props.value)}</span>
      <button
        data-testid="change-30"
        disabled={props.disabled}
        onClick={event => props.onChange?.(event as unknown as Event, 30)}
      >
        change-30
      </button>
      <button
        data-testid="commit-30"
        disabled={props.disabled}
        onClick={event =>
          props.onChangeCommitted?.(event as unknown as Event, 30)
        }
      >
        commit-30
      </button>
      <button
        data-testid="commit-60"
        disabled={props.disabled}
        onClick={event =>
          props.onChangeCommitted?.(event as unknown as Event, 60)
        }
      >
        commit-60
      </button>
    </div>
  ),
}))

vi.mock("../../room/mb", async () => {
  const actual = await vi.importActual("../../room/mb")
  return {
    ...actual,
    seekToOffset: mocks.seekToOffset,
    broadcastSeekPreview: mocks.broadcastSeekPreview,
    onSeekPreview: mocks.onSeekPreview,
  }
})

vi.mock("../../ui/providers/MessageProvider", () => ({
  useMessage: mocks.useMessage,
}))

vi.mock("../../ui/providers/RoleProvider", () => ({
  Role: {
    GM: 0,
    Player: 1,
  },
  useRole: mocks.useRole,
}))

import { useMessage } from "../../ui/providers/MessageProvider"
import { Role, useRole } from "../../ui/providers/RoleProvider"

describe("TrackProgress UI", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mockUseRole = useRole as ReturnType<typeof vi.fn>
    mockUseRole.mockReturnValue(Role.GM)
    mocks.seekToOffset.mockResolvedValue(undefined)
    mocks.onSeekPreview.mockImplementation(() => vi.fn())
  })

  function latestSeekPreviewCallback() {
    const calls = mocks.onSeekPreview.mock.calls
    return calls[calls.length - 1][0]
  }

  it("renders skeleton when no message is playing", () => {
    render(<TrackProgress />)

    expect(screen.getByTestId("skeleton")).toBeDefined()
  })

  it("displays current progress and duration when track is playing", () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "test-123",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Play,
      offset: 30,
      duration: 180,
      track: {
        title: "Test Track",
        url: "https://example.com/test.mp3",
        tags: [],
      },
    })

    render(<TrackProgress />)

    // Should display current time and total duration
    const timeTexts = screen.getAllByText(/\d{2}:\d{2}:\d{2}/)
    expect(timeTexts.length).toBeGreaterThan(0)
  })

  it("displays paused progress without updating", () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "test-456",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Pause,
      offset: 45,
      duration: 120,
      track: {
        title: "Paused Track",
        url: "https://example.com/paused.mp3",
        tags: [],
      },
    })

    render(<TrackProgress />)

    // Should display the paused offset
    const timeTexts = screen.getAllByText(/\d{2}:\d{2}:\d{2}/)
    expect(timeTexts.length).toBeGreaterThan(0)
  })

  it("handles edge case of zero duration", () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "test-zero",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Play,
      offset: 0,
      duration: 0,
      track: {
        title: "Zero Duration Track",
        url: "https://example.com/zero.mp3",
        tags: [],
      },
    })

    render(<TrackProgress />)

    expect(screen.getByTestId("slider-root")).toBeDefined()
  })

  it("disables seeking for players", () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "test-player-role",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Play,
      offset: 0,
      duration: 200,
      track: {
        title: "Locked Track",
        url: "https://example.com/locked.mp3",
        tags: [],
      },
    })

    const mockUseRole = useRole as ReturnType<typeof vi.fn>
    mockUseRole.mockReturnValue(Role.Player)

    render(<TrackProgress />)

    expect(screen.getByTestId("commit-30")).toHaveProperty("disabled", true)
    fireEvent.click(screen.getByTestId("commit-30"))

    expect(mocks.seekToOffset).not.toHaveBeenCalled()
  })

  it("shows the new track progress immediately after a track switch", () => {
    vi.useFakeTimers()
    const baseTime = new Date("2026-01-01T00:00:00Z")
    vi.setSystemTime(baseTime)
    let message: Message = {
      id: "msg-b-paused", time: baseTime, action: Action.Pause, offset: 30 * 60, duration: 40 * 60,
      track: { title: "Track B", url: "https://example.com/b.mp3", tags: [] },
    }
    mocks.useMessage.mockImplementation(() => message)

    const { rerender } = render(<TrackProgress />)
    message = {
      id: "msg-a-play", time: baseTime, action: Action.Play, offset: 5 * 60, duration: 20 * 60,
      track: { title: "Track A", url: "https://example.com/a.mp3", tags: [] },
    }
    rerender(<TrackProgress />)

    expect(screen.getByText("00:05:00")).toBeDefined()
    expect(screen.getByText("00:20:00")).toBeDefined()
    expect(screen.queryByText("00:30:00")).toBeNull()
    vi.useRealTimers()
  })

  it("keeps the synced position when a second grab starts without movement", () => {
    vi.useFakeTimers()
    let message: Message = {
      id: "msg-1", time: new Date("2026-01-01T00:00:00Z"), action: Action.Pause, offset: 10, duration: 100,
      track: { title: "Freeze Regression", url: "https://example.com/freeze.mp3", tags: [] },
    }
    mocks.useMessage.mockImplementation(() => message)

    const { rerender } = render(<TrackProgress />)
    fireEvent.click(screen.getByTestId("change-30"))
    fireEvent.click(screen.getByTestId("commit-30"))
    message = { ...message, id: "msg-2", offset: 40 }
    rerender(<TrackProgress />)
    act(() => { vi.advanceTimersByTime(2500) })
    fireEvent.mouseDown(screen.getByTestId("slider-root"))

    expect(screen.getByText("00:00:40")).toBeDefined()
    expect(screen.queryByText("00:00:30")).toBeNull()
    vi.useRealTimers()
  })

  it("does not leak optimistic seek offsets across track switches", () => {
    let message: Message = {
      id: "msg-a", time: new Date("2026-01-01T00:00:00Z"), action: Action.Pause, offset: 10, duration: 100,
      track: { title: "Track A", url: "https://example.com/a.mp3", tags: [] },
    }
    mocks.useMessage.mockImplementation(() => message)

    const { rerender } = render(<TrackProgress />)
    fireEvent.click(screen.getByTestId("commit-30"))
    message = { ...message, id: "msg-b", offset: 50, track: { title: "Track B", url: "https://example.com/b.mp3", tags: [] } }
    rerender(<TrackProgress />)
    fireEvent.click(screen.getByTestId("commit-60"))
    message = { ...message, id: "msg-c", offset: 20, track: { title: "Track C", url: "https://example.com/c.mp3", tags: [] } }
    rerender(<TrackProgress />)

    expect(screen.getByText("00:00:20")).toBeDefined()
    expect(screen.queryByText("00:01:00")).toBeNull()
    expect(screen.queryByText("00:00:30")).toBeNull()
  })

  it("broadcasts a seek preview while the GM drags the slider", () => {
    mocks.useMessage.mockReturnValue({
      id: "msg-drag",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Pause,
      offset: 0,
      duration: 200,
      track: { title: "Track A", url: "https://example.com/a.mp3", tags: [] },
    })

    render(<TrackProgress />)
    fireEvent.click(screen.getByTestId("change-30"))

    expect(mocks.broadcastSeekPreview).toHaveBeenCalledWith(60)
  })

  it("does not broadcast a seek preview for players", () => {
    const mockUseRole = useRole as ReturnType<typeof vi.fn>
    mockUseRole.mockReturnValue(Role.Player)
    mocks.useMessage.mockReturnValue({
      id: "msg-drag-player",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Pause,
      offset: 0,
      duration: 200,
      track: { title: "Track A", url: "https://example.com/a.mp3", tags: [] },
    })

    render(<TrackProgress />)
    fireEvent.click(screen.getByTestId("change-30"))

    expect(mocks.broadcastSeekPreview).not.toHaveBeenCalled()
  })

  it("shows a live preview position broadcast from another client", () => {
    const track = { title: "Track A", url: "https://example.com/a.mp3", tags: [] }
    mocks.useMessage.mockReturnValue({
      id: "msg-preview",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Pause,
      offset: 0,
      duration: 200,
      track,
    })

    render(<TrackProgress />)
    act(() => {
      latestSeekPreviewCallback()({
        trackUrl: canonicalizeTrackUrl(track.url),
        offsetSeconds: 42,
      })
    })

    expect(screen.getByText("00:00:42")).toBeDefined()
  })

  it("ignores a preview broadcast for a different track", () => {
    const track = { title: "Track A", url: "https://example.com/a.mp3", tags: [] }
    mocks.useMessage.mockReturnValue({
      id: "msg-preview-other",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Pause,
      offset: 10,
      duration: 200,
      track,
    })

    render(<TrackProgress />)
    act(() => {
      latestSeekPreviewCallback()({
        trackUrl: canonicalizeTrackUrl("https://example.com/other.mp3"),
        offsetSeconds: 42,
      })
    })

    expect(screen.getByText("00:00:10")).toBeDefined()
    expect(screen.queryByText("00:00:42")).toBeNull()
  })

  it("clears the remote preview after it expires", () => {
    vi.useFakeTimers()
    const track = { title: "Track A", url: "https://example.com/a.mp3", tags: [] }
    mocks.useMessage.mockReturnValue({
      id: "msg-preview-expire",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Pause,
      offset: 10,
      duration: 200,
      track,
    })

    render(<TrackProgress />)
    act(() => {
      latestSeekPreviewCallback()({
        trackUrl: canonicalizeTrackUrl(track.url),
        offsetSeconds: 42,
      })
    })
    expect(screen.getByText("00:00:42")).toBeDefined()

    act(() => {
      vi.advanceTimersByTime(2100)
    })

    expect(screen.getByText("00:00:10")).toBeDefined()
    expect(screen.queryByText("00:00:42")).toBeNull()
    vi.useRealTimers()
  })
})
