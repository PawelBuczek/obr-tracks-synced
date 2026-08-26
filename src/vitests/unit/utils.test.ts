import { describe, expect, it } from "vitest"
import { canonicalizeTrackUrl, isSameTrack } from "../../domain/track"
import { cleanTrack, checkTrack } from "../../shared/utils"

describe("track cleaning", () => {
  it("trims titles, removes URL whitespace, and lowercases URLs", () => {
    const track = {
      title: "  Track title  ",
      url: " HTTPS://EXAMPLE.COM/Track\n File.MP3 ",
      tags: [" calm ", "", "focus"],
    }

    expect(cleanTrack(track)).toEqual({
      title: "Track title",
      url: "https://example.com/trackfile.mp3",
      tags: [2, 3],
      offset: 0,
    })
  })

  it("validates the cleaned track", () => {
    const result = checkTrack({
      title: "  Track title  ",
      url: " HTTPS://EXAMPLE.COM/track.mp3 ",
      tags: [],
    })

    expect(result.validation).toBeUndefined()
    expect(result.fixed).toEqual({
      title: "Track title",
      url: "https://example.com/track.mp3",
      tags: [],
      offset: 0,
    })
  })

  it("canonicalizes Dropbox share URLs and keeps them idempotent", () => {
    const shareUrl = "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0"
    const directUrl = "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1"

    expect(canonicalizeTrackUrl(shareUrl)).toBe(directUrl)
    expect(canonicalizeTrackUrl(directUrl)).toBe(directUrl)
    expect(canonicalizeTrackUrl(canonicalizeTrackUrl(shareUrl))).toBe(directUrl)
  })

  it("treats canonicalized Dropbox variants as the same track", () => {
    const shareUrl = "https://www.dropbox.com/scl/fi/example/track.mp3?dl=0"
    const directUrl = "https://dl.dropboxusercontent.com/scl/fi/example/track.mp3?dl=1"

    expect(
      isSameTrack(
        { title: "A", url: shareUrl, tags: [] },
        { title: "B", url: directUrl, tags: [] },
      ),
    ).toBe(true)
  })
})