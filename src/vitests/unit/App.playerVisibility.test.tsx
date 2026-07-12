import { useEffect } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Action } from "../../room/mb"
import { key } from "../../shared/key"
import { App } from "../../ui/app/App"

const fixture = vi.hoisted(() => ({
  tracks: [
    {
      title: "Track One",
      url: "https://example.com/one.mp3",
      tags: ["ambient"],
    },
    {
      title: "Track Two",
      url: "https://example.com/two.mp3",
      tags: ["battle"],
    },
  ],
}))

const roleState = vi.hoisted(() => ({
  currentRole: 0,
}))

const controlsState = vi.hoisted(() => ({
  lastMuteProps: undefined as
    | { mute: boolean; onMute: (mute: boolean) => void }
    | undefined,
  lastVolumeProps: undefined as
    | { volume: number; onVolume: (volume: number) => void; disabled: boolean }
    | undefined,
}))

vi.mock("../../room/library", () => ({
  onLibraryChange: vi.fn((setLibrary: (tracks: typeof fixture.tracks) => void) => {
    setLibrary(fixture.tracks)
    return () => undefined
  }),
  moveTrackUpInLibrary: vi.fn(),
  moveTrackDownInLibrary: vi.fn(),
  getLibrarySortMode: vi.fn(() => "not_sorted"),
  setLibrarySortMode: vi.fn(),
  onLibrarySortModeChange: vi.fn((callback: (mode: string) => void) => {
    callback("not_sorted")
    return () => undefined
  }),
}))

vi.mock("../../ui/controls", () => ({
  ActionPopover: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  MuteButton: (props: { mute: boolean; onMute: (mute: boolean) => void }) => {
    controlsState.lastMuteProps = props
    return null
  },
  VolumeSlider: (props: {
    volume: number
    onVolume: (volume: number) => void
    disabled: boolean
  }) => {
    controlsState.lastVolumeProps = props
    return null
  },
}))

vi.mock("../../ui/player", () => ({
  Player: () => <div data-testid="player">Player</div>,
}))

vi.mock("../../ui/library", () => ({
  Confirm: () => null,
  IconMenu: () => <div data-testid="gm-icon-menu">IconMenu</div>,
  TrackDialog: () => null,
  TrackSearch: ({
    trackLibrary,
    onSearch,
  }: {
    trackLibrary: typeof fixture.tracks
    onSearch: (results: { item: (typeof fixture.tracks)[number]; refIndex: number }[]) => void
  }) => {
    useEffect(() => {
      onSearch(trackLibrary.map((item, refIndex) => ({ item, refIndex })))
    }, [trackLibrary, onSearch])
    return null
  },
  TrackList: ({
    searchResults,
  }: {
    searchResults: { item: (typeof fixture.tracks)[number] }[]
  }) => (
    <div data-testid="track-list">
      {searchResults.map(result => (
        <div key={result.item.url}>{result.item.title}</div>
      ))}
    </div>
  ),
}))

vi.mock("../../ui/providers", () => {
  enum Role {
    GM,
    Player,
  }

  return {
    Role,
    useRole: vi.fn(() => roleState.currentRole),
    useMessage: vi.fn(() => undefined),
    GMOnly: ({ children }: { children?: React.ReactNode }) => (
      <>{roleState.currentRole === Role.GM ? children : null}</>
    ),
    WithRole: ({ gm, player }: { gm?: React.ReactNode; player?: React.ReactNode }) => (
      <>{roleState.currentRole === Role.GM ? gm : player}</>
    ),
  }
})

import { Role, useMessage } from "../../ui/providers"

describe("App player visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    roleState.currentRole = Role.GM
    controlsState.lastMuteProps = undefined
    controlsState.lastVolumeProps = undefined
  })

  it("shows the player and keeps both library tracks rendered when playback starts", () => {
    const mockUseMessage = useMessage as ReturnType<typeof vi.fn>
    mockUseMessage.mockReturnValue({
      id: "message-1",
      time: new Date("2026-01-01T00:00:00Z"),
      action: Action.Play,
      offset: 0,
      duration: 120,
      track: fixture.tracks[0],
    })

    render(<App />)

    expect(screen.getByTestId("player")).toBeDefined()
    expect(screen.getByTestId("track-list")).toBeDefined()
    expect(screen.getByText("Track One")).toBeDefined()
    expect(screen.getByText("Track Two")).toBeDefined()
  })

  it("hides GM-only chrome for player users while keeping the shared player visible", () => {
    roleState.currentRole = Role.Player

    render(<App />)

    expect(screen.getByTestId("player")).toBeDefined()
    expect(screen.queryByTestId("track-list")).toBeNull()
    expect(screen.queryByTestId("gm-icon-menu")).toBeNull()
    expect(screen.queryByText("Track One")).toBeNull()
    expect(screen.queryByText("Track Two")).toBeNull()
  })

  it("initializes audio controls from persisted settings to avoid rejoin flicker", () => {
    localStorage.setItem(key("mute"), "false")
    localStorage.setItem(key("volume"), "0.6")

    render(<App />)

    expect(controlsState.lastMuteProps?.mute).toBe(false)
    expect(controlsState.lastVolumeProps?.volume).toBe(0.6)
    expect(controlsState.lastVolumeProps?.disabled).toBe(false)
  })
})