import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { key } from "../../shared/key"
import { MuteButton } from "../../ui/controls/MuteButton"

describe("MuteButton local cache", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it("loads mute state from local storage and persists changes", async () => {
    const onMute = vi.fn()
    const mutePath = key("mute")

    localStorage.setItem(mutePath, "false")

    render(<MuteButton onMute={onMute} />)

    expect(onMute).toHaveBeenLastCalledWith(false)

    await userEvent.click(screen.getByRole("button"))

    expect(onMute).toHaveBeenLastCalledWith(true)
    expect(localStorage.getItem(mutePath)).toBe("true")
  })
})