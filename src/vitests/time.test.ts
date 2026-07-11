import { describe, expect, it } from "vitest"
import { getTimeSyncUrl } from "../shared/timeUrl"

describe("getTimeSyncUrl", () => {
  it("keeps the GitHub Pages subpath when deriving the time sync URL", () => {
    expect(
      getTimeSyncUrl("https://pawelbuczek.github.io/obr-tracks-synced/"),
    ).toBe("https://pawelbuczek.github.io/obr-tracks-synced/")
  })

  it("falls back to the site root when no subpath is present", () => {
    expect(getTimeSyncUrl("https://example.com/")).toBe("https://example.com/")
  })
})
