import { describe, expect, it } from "vitest"
import {
  BUILT_IN_TAGS,
  formatTrackTag,
  getBuiltinTagId,
  getBuiltinTagName,
} from "../../domain/tags"

describe("built-in tag registry", () => {
  it("maps built-in names to stable ids and back", () => {
    expect(getBuiltinTagId("ambient")).toBe(0)
    expect(getBuiltinTagId("  AMBIENT  ")).toBe(0)
    expect(getBuiltinTagName(0)).toBe("ambient")
    expect(getBuiltinTagName(BUILT_IN_TAGS.length - 1)).toBe(
      BUILT_IN_TAGS[BUILT_IN_TAGS.length - 1],
    )
  })

  it("formatting stays human-readable for legacy and numeric tag values", () => {
    expect(formatTrackTag(0)).toBe("ambient")
    expect(formatTrackTag(" calm ")).toBe("calm")
    expect(formatTrackTag(999)).toBe("999")
  })

  it("converts built-in names to numeric IDs for room metadata parsing", () => {
    expect(getBuiltinTagId("battle")).toBe(1)
    expect(getBuiltinTagId("  BATTLE  ")).toBe(1)
    expect(getBuiltinTagId("unknown")).toBeUndefined()
  })
})
