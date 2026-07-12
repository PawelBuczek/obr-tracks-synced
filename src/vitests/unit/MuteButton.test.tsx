import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MuteButton } from "../../ui/controls/MuteButton"

describe("MuteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("toggles mute state through callback", async () => {
    const onMute = vi.fn()
    render(<MuteButton mute={false} onMute={onMute} />)

    await userEvent.click(screen.getByRole("button"))

    expect(onMute).toHaveBeenCalledWith(true)
  })
})