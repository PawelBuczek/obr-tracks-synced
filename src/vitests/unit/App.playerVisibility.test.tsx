import { useEffect } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Action } from "../../room/mb"
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

vi.mock("../../room/library", () => ({
  onLibraryChange: vi.fn((setLibrary: (tracks: typeof fixture.tracks) => void) => {
    setLibrary(fixture.tracks)
    return () => undefined
  }),
}))

vi.mock("../../ui/controls", () => ({
  ActionPopover: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  MuteButton: () => null,
  VolumeSlider: () => null,
}))

vi.mock("../../ui/player", () => ({
  Player: () => <div data-testid="player">Player</div>,
}))

vi.mock("../../ui/library", () => ({
  Confirm: () => null,
  IconMenu: () => null,
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
    useRole: vi.fn(() => Role.GM),
    useMessage: vi.fn(() => undefined),
    GMOnly: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    WithRole: ({ gm, player }: { gm?: React.ReactNode; player?: React.ReactNode }) => (
      <>{gm ?? player}</>
    ),
  }
})

import { useMessage } from "../../ui/providers"

describe("App player visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})