import { beforeEach, describe, expect, it, vi } from "vitest"
import { getVolume, setVolume } from "../../shared/volume"

describe("shared volume cache", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("returns the fallback volume when cache is empty or invalid", () => {
    expect(getVolume()).toBe(0.3)

    localStorage.setItem("com.obr.tracks/volume", "not-a-number")
    expect(getVolume()).toBe(0.3)

    localStorage.setItem("com.obr.tracks/volume", "2")
    expect(getVolume()).toBe(0.3)
  })

  it("persists valid volume values in local storage", () => {
    setVolume(0.75)

    expect(localStorage.getItem("com.obr.tracks/volume")).toBe("0.75")
    expect(getVolume()).toBe(0.75)
  })

  it("ignores values above the allowed range", () => {
    setVolume(1.2)

    expect(localStorage.getItem("com.obr.tracks/volume")).toBeNull()
  })
})