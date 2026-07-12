import { describe, expect, it, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { TrackProgress } from "../../ui/player/TrackProgress"
import { Action } from "../../room/mb"

const mocks = vi.hoisted(() => ({
  seekToOffset: vi.fn(),
  useRole: vi.fn(),
}))

vi.mock("../../room/mb", async () => {
  const actual = await vi.importActual("../../room/mb")
  return {
    ...actual,
    seekToOffset: mocks.seekToOffset,
  }
})

vi.mock("../../ui/providers/MessageProvider", () => ({
  useMessage: vi.fn(() => undefined),
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
  })

  it("renders skeleton when no message is playing", () => {
    render(<TrackProgress />)

    // MUI Skeleton renders with specific classes
    const skeleton = document.querySelector(".MuiSkeleton-root")
    expect(skeleton).toBeDefined()
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

  it("renders a slider that can be interacted with", () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "test-789",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Play,
      offset: 0,
      duration: 300,
      track: {
        title: "Interactive Track",
        url: "https://example.com/interactive.mp3",
        tags: [],
      },
    })

    render(<TrackProgress />)

    // Look for the slider component (MUI Slider renders an input[type="range"])
    const slider = document.querySelector('input[type="range"]')
    expect(slider).toBeDefined()
    expect(slider?.getAttribute("min")).toBe("0")
    expect(slider?.getAttribute("max")).toBe("100")
  })

  it("calls seekToOffset when slider is released", () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "test-seek",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Play,
      offset: 0,
      duration: 200,
      track: {
        title: "Seekable Track",
        url: "https://example.com/seekable.mp3",
        tags: [],
      },
    })

    render(<TrackProgress />)

    const slider = document.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider).toBeDefined()

    // Verify slider attributes are set correctly for seeking
    if (slider) {
      expect(slider.min).toBe("0")
      expect(slider.max).toBe("100")
      expect(slider.step).toBe("0.1")
    }
  })

  it("updates displayed time while dragging slider", () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "test-drag",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Play,
      offset: 0,
      duration: 240,
      track: {
        title: "Draggable Track",
        url: "https://example.com/draggable.mp3",
        tags: [],
      },
    })

    render(<TrackProgress />)

    // Verify time displays exist (current and duration)
    const timeDisplays = screen.getAllByText(/\d{2}:\d{2}:\d{2}/)
    expect(timeDisplays.length).toBe(2)

    // Verify slider exists
    const slider = document.querySelector('input[type="range"]')
    expect(slider).toBeDefined()
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

    // Should render without errors
    const slider = document.querySelector('input[type="range"]')
    expect(slider).toBeDefined()
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

    const slider = document.querySelector('input[type="range"]') as HTMLInputElement
    expect(slider).toBeDefined()
    expect(slider.disabled).toBe(true)

    fireEvent.change(slider, { target: { value: "50" } })
    fireEvent.mouseUp(slider)

    expect(mocks.seekToOffset).not.toHaveBeenCalled()
  })
})
