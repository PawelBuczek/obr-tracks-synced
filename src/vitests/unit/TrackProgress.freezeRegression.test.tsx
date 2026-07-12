import { describe, expect, it, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { TrackProgress } from "../../ui/player/TrackProgress"
import { Action, type Message } from "../../room/mb"

const mocks = vi.hoisted(() => ({
  seekToOffset: vi.fn(),
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
        onClick={event => props.onChange?.(event as unknown as Event, 30)}
      >
        change-30
      </button>
      <button
        data-testid="commit-60"
        onClick={event =>
          props.onChangeCommitted?.(event as unknown as Event, 60)
        }
      >
        commit-60
      </button>
      <button
        data-testid="commit-30"
        onClick={event =>
          props.onChangeCommitted?.(event as unknown as Event, 30)
        }
      >
        commit-30
      </button>
    </div>
  ),
}))

vi.mock("../../room/mb", async () => {
  const actual = await vi.importActual("../../room/mb")
  return {
    ...actual,
    seekToOffset: mocks.seekToOffset,
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

import { Role } from "../../ui/providers/RoleProvider"

describe("TrackProgress freeze regression", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.seekToOffset.mockResolvedValue(undefined)
    mocks.useRole.mockReturnValue(Role.GM)
  })

  it("keeps current synced position when second grab starts without movement", () => {
    vi.useFakeTimers()

    let message: Message = {
      id: "msg-1",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Pause,
      offset: 10,
      duration: 100,
      track: {
        title: "Freeze Regression",
        url: "https://example.com/freeze.mp3",
        tags: [],
      },
    }

    mocks.useMessage.mockImplementation(() => message)

    const { rerender } = render(<TrackProgress />)
    expect(screen.getByText("00:00:10")).toBeDefined()

    // First seek: drag to 30s, then commit (clears drag mode).
    fireEvent.click(screen.getByTestId("change-30"))
    fireEvent.click(screen.getByTestId("commit-30"))

    // Later sync update moves playback to 40s.
    message = {
      ...message,
      id: "msg-2",
      offset: 40,
    }
    rerender(<TrackProgress />)

    // Let optimistic seek display expire so synced value is shown.
    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.getByText("00:00:40")).toBeDefined()

    // Second grab starts but user has not moved yet.
    fireEvent.mouseDown(screen.getByTestId("slider-root"))

    // Regression expectation: no snap back to stale 30s.
    expect(screen.getByText("00:00:40")).toBeDefined()
    expect(screen.queryByText("00:00:30")).toBeNull()

    vi.useRealTimers()
  })

  it("does not leak optimistic seek offsets across three track switches", () => {
    let message: Message = {
      id: "msg-a",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Pause,
      offset: 10,
      duration: 100,
      track: {
        title: "Track A",
        url: "https://example.com/a.mp3",
        tags: [],
      },
    }

    mocks.useMessage.mockImplementation(() => message)

    const { rerender } = render(<TrackProgress />)
    expect(screen.getByText("00:00:10")).toBeDefined()

    fireEvent.click(screen.getByTestId("change-30"))
    fireEvent.click(screen.getByTestId("commit-30"))
    expect(screen.getByText("00:00:30")).toBeDefined()

    message = {
      ...message,
      id: "msg-b",
      offset: 50,
      track: {
        title: "Track B",
        url: "https://example.com/b.mp3",
        tags: [],
      },
    }
    rerender(<TrackProgress />)

    expect(screen.getByText("00:00:50")).toBeDefined()
    expect(screen.queryByText("00:00:30")).toBeNull()

    fireEvent.click(screen.getByTestId("commit-60"))
    expect(screen.getByText("00:01:00")).toBeDefined()

    message = {
      ...message,
      id: "msg-c",
      offset: 20,
      track: {
        title: "Track C",
        url: "https://example.com/c.mp3",
        tags: [],
      },
    }
    rerender(<TrackProgress />)

    expect(screen.getByText("00:00:20")).toBeDefined()
    expect(screen.queryByText("00:01:00")).toBeNull()
    expect(screen.queryByText("00:00:30")).toBeNull()
  })
})
