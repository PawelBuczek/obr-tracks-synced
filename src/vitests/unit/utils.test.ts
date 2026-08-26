import { describe, expect, it } from "vitest"
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
      tags: ["calm", "focus"],
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
    })
  })
})