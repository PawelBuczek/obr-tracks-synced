import { beforeEach, describe, expect, it } from "vitest"
import {
  getSortMode,
  LibrarySortMode,
  setSortMode,
} from "../../shared/sortMode"

describe("local library sort mode", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("uses not-sorted when the preference is missing or invalid", () => {
    expect(getSortMode()).toBe(LibrarySortMode.NotSorted)

    localStorage.setItem("com.obr.tracks/librarySortMode", "invalid")

    expect(getSortMode()).toBe(LibrarySortMode.NotSorted)
  })

  it("persists valid preferences locally", () => {
    setSortMode(LibrarySortMode.Ascending)

    expect(localStorage.getItem("com.obr.tracks/librarySortMode")).toBe(
      LibrarySortMode.Ascending,
    )
    expect(getSortMode()).toBe(LibrarySortMode.Ascending)
  })

  it("falls back when local storage is unavailable", () => {
    const storage = globalThis.localStorage
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("storage unavailable")
      },
    })

    expect(getSortMode()).toBe(LibrarySortMode.NotSorted)
    expect(() => setSortMode(LibrarySortMode.Descending)).not.toThrow()

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: storage,
    })
  })
})