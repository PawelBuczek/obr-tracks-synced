import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TrackList } from "../../ui/library/TrackList"

const mocks = vi.hoisted(() => ({
  play: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getTrackListClickAction: vi.fn(),
  optimisticPlay: vi.fn(),
  optimisticPause: vi.fn(),
  optimisticResume: vi.fn(),
}))

vi.mock("../../room/mb", async () => {
  const actual = await vi.importActual("../../room/mb")

  return {
    ...actual,
    play: mocks.play,
    pause: mocks.pause,
    resume: mocks.resume,
  }
})

vi.mock("../../domain/trackListActions", () => ({
  getTrackListClickAction: mocks.getTrackListClickAction,
}))

vi.mock("../../room/library", () => ({
  deleteTrackFromLibrary: vi.fn(),
}))

vi.mock("../../ui/providers/MessageProvider", () => ({
  useMessage: vi.fn(() => undefined),
  useMessageOptimisticActions: vi.fn(() => ({
    optimisticPlay: mocks.optimisticPlay,
    optimisticPause: mocks.optimisticPause,
    optimisticResume: mocks.optimisticResume,
    optimisticStop: vi.fn(),
  })),
}))

const track = {
  title: "Battle Theme",
  url: "https://example.com/battle.mp3",
  tags: ["combat"],
}

function renderTrackList() {
  render(
    <TrackList
      searchResults={[{ item: track, refIndex: 0 }]}
      editTrack={() => undefined}
      confirm={() => undefined}
    />,
  )
}

describe("TrackList optimistic UI on click", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses canonical play flow for track switches without optimistic play", async () => {
    mocks.getTrackListClickAction.mockReturnValue("play")
    renderTrackList()

    await userEvent.click(screen.getByText(track.title))

    expect(mocks.play).toHaveBeenCalledTimes(1)
    expect(mocks.play).toHaveBeenCalledWith(track)
    expect(mocks.optimisticPlay).not.toHaveBeenCalled()
  })

  it("still applies optimistic pause for pause clicks", async () => {
    mocks.getTrackListClickAction.mockReturnValue("pause")
    renderTrackList()

    await userEvent.click(screen.getByText(track.title))

    expect(mocks.optimisticPause).toHaveBeenCalledTimes(1)
    expect(mocks.pause).toHaveBeenCalledTimes(1)
  })

  it("still applies optimistic resume for resume clicks", async () => {
    mocks.getTrackListClickAction.mockReturnValue("resume")
    renderTrackList()

    await userEvent.click(screen.getByText(track.title))

    expect(mocks.optimisticResume).toHaveBeenCalledTimes(1)
    expect(mocks.resume).toHaveBeenCalledTimes(1)
  })
})
