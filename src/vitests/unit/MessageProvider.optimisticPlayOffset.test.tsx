import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import {
  MessageProvider,
  useMessage,
  useMessageOptimisticActions,
} from "../../ui/providers/MessageProvider"
import { Track } from "../../domain/track"

const mocks = vi.hoisted(() => ({
  onMessage: vi.fn(() => () => undefined),
  getCachedTrackOffset: vi.fn(() => 42),
}))

vi.mock("../../room/mb", () => ({
  Action: {
    Play: 0,
    Pause: 1,
  },
  onMessage: mocks.onMessage,
  getCachedTrackOffset: mocks.getCachedTrackOffset,
}))

function Harness() {
  const message = useMessage()
  const { optimisticPlay } = useMessageOptimisticActions()

  const track: Track = {
    title: "Other Track",
    url: "https://example.com/other.mp3",
    tags: [],
  }

  return (
    <>
      <button onClick={() => optimisticPlay(track)}>play-other</button>
      <span data-testid="offset">{String(message?.offset ?? -1)}</span>
    </>
  )
}

describe("MessageProvider optimistic play", () => {
  it("uses cached track offset when switching to a different track", () => {
    render(
      <MessageProvider>
        <Harness />
      </MessageProvider>,
    )

    fireEvent.click(screen.getByText("play-other"))

    expect(screen.getByTestId("offset").textContent).toBe("42")
    expect(mocks.getCachedTrackOffset).toHaveBeenCalledWith(
      "https://example.com/other.mp3",
    )
  })
})
