import { describe, expect, it } from "vitest"
import {
  BUILT_IN_TAGS,
  CUSTOM_TAG_ID_MAX,
  CUSTOM_TAG_ID_MIN,
  formatTrackTag,
  getBuiltinTagId,
  getBuiltinTagName,
  isCustomTagId,
  isValidTagId,
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

  it("validates the stable built-in and custom tag ID ranges", () => {
    expect(isValidTagId(0)).toBe(true)
    expect(isValidTagId(BUILT_IN_TAGS.length - 1)).toBe(true)
    expect(isValidTagId(CUSTOM_TAG_ID_MIN)).toBe(true)
    expect(isValidTagId(CUSTOM_TAG_ID_MAX)).toBe(true)
    expect(isValidTagId(100)).toBe(false)
    expect(isCustomTagId(CUSTOM_TAG_ID_MIN)).toBe(true)
    expect(isCustomTagId(84)).toBe(false)
  })
})
