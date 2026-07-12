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

const trackTwo = {
  title: "Forest Theme",
  url: "https://example.com/forest.mp3",
  tags: ["ambient"],
}

function renderTrackList(
  searchResults: Array<{ item: typeof track; refIndex: number }> = [
    { item: track, refIndex: 0 },
  ],
  moveTrackUp = () => undefined,
  moveTrackDown = () => undefined,
  canReorder = true,
) {
  render(
    <TrackList
      searchResults={searchResults}
      editTrack={() => undefined}
      confirm={() => undefined}
      moveTrackUp={moveTrackUp}
      moveTrackDown={moveTrackDown}
      canReorder={canReorder}
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

  it("reorders via arrow buttons without triggering playback click", async () => {
    const moveTrackDown = vi.fn()
    const moveTrackUp = vi.fn()

    renderTrackList(
      [
        { item: track, refIndex: 0 },
        { item: trackTwo, refIndex: 1 },
      ],
      moveTrackUp,
      moveTrackDown,
    )

    await userEvent.click(screen.getByLabelText("Move Battle Theme down"))
    await userEvent.click(screen.getByLabelText("Move Forest Theme up"))

    expect(moveTrackDown).toHaveBeenCalledWith(track)
    expect(moveTrackUp).toHaveBeenCalledWith(trackTwo)
    expect(mocks.play).not.toHaveBeenCalled()
    expect(mocks.pause).not.toHaveBeenCalled()
    expect(mocks.resume).not.toHaveBeenCalled()
  })

  it("disables reorder buttons when alphabetical sort is enabled", async () => {
    const moveTrackDown = vi.fn()
    const moveTrackUp = vi.fn()

    renderTrackList(
      [
        { item: track, refIndex: 0 },
        { item: trackTwo, refIndex: 1 },
      ],
      moveTrackUp,
      moveTrackDown,
      false,
    )

    const downButton = screen.getByLabelText("Move Battle Theme down")
    const upButton = screen.getByLabelText("Move Forest Theme up")

    expect(downButton).toHaveProperty("disabled", true)
    expect(upButton).toHaveProperty("disabled", true)

    expect(moveTrackDown).not.toHaveBeenCalled()
    expect(moveTrackUp).not.toHaveBeenCalled()
  })
})
