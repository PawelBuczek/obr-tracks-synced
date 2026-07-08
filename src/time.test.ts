import { describe, expect, it } from "vitest"
import { getTimeSyncUrl } from "./timeUrl"

describe("getTimeSyncUrl", () => {
  it("keeps the GitHub Pages subpath when deriving the time sync URL", () => {
    expect(
      getTimeSyncUrl("https://pawelbuczek.github.io/obr-tracks-pausing/"),
    ).toBe("https://pawelbuczek.github.io/obr-tracks-pausing/")
  })

  it("falls back to the site root when no subpath is present", () => {
    expect(getTimeSyncUrl("https://example.com/")).toBe("https://example.com/")
  })
})
