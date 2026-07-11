import { describe, expect, it, vi } from "vitest"

vi.mock("../../infra/time", () => ({
  now: () => new Date("2026-01-01T00:00:00.000Z"),
}))

vi.mock("@owlbear-rodeo/sdk", () => ({
  default: {
    notification: {
      show: vi.fn(),
    },
  },
}))

import { TracksToCsv, csvToTracks } from "../../io/csv"

describe("csv import and export", () => {
  it("parses valid csv rows into tracks", () => {
    const input = [
      "url,title,tags",
      "https://example.com/a.mp3,Track A,ambient|calm",
      "https://example.com/b.mp3,Track B,",
    ].join("\n")

    const result = csvToTracks(input)

    expect(result.errors).toEqual([])
    expect(result.tracks).toEqual([
      {
        title: "Track A",
        url: "https://example.com/a.mp3",
        tags: ["ambient", "calm"],
      },
      {
        title: "Track B",
        url: "https://example.com/b.mp3",
        tags: [],
      },
    ])
  })

  it("rejects invalid headers", () => {
    const input = [
      "name,url,tags",
      "https://example.com/a.mp3,Track A,ambient",
    ].join("\n")

    const result = csvToTracks(input)

    expect(result.tracks).toEqual([])
    expect(result.errors).toEqual([
      {
        row: 0,
        errors: ["Invalid header"],
      },
    ])
  })

  it("returns no tracks when any row has validation errors", () => {
    const input = [
      "url,title,tags",
      "https://example.com/good.mp3,Good,ok",
      "https://example.com/blank-title.mp3,,bad",
      "not-a-url,Bad Url,bad",
    ].join("\n")

    const result = csvToTracks(input)

    expect(result.tracks).toEqual([])
    expect(result.errors).toEqual([
      {
        row: 2,
        errors: ["Title can not be blank"],
      },
      {
        row: 3,
        errors: ["Invalid url"],
      },
    ])
  })

  it("round-trips tracks through csv export and parse", () => {
    const tracks = [
      {
        title: "Alpha",
        url: "https://example.com/alpha.mp3",
        tags: ["one", "two"],
      },
      {
        title: "Beta",
        url: "https://example.com/beta.mp3",
        tags: [],
      },
    ]

    const csv = TracksToCsv(tracks)
    const result = csvToTracks(csv)

    expect(result.errors).toEqual([])
    expect(result.tracks).toEqual(tracks)
  })
})