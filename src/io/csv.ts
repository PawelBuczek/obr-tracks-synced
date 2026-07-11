import Papa from "papaparse"
import { Track } from "../domain/track"
import { checkTrack } from "../shared/utils"

interface Row {
  url: string
  title: string
  tags: string
}

export interface CsvError {
  row: number
  errors: string[]
}
function isRow(something: any): something is Row {
  const { title, url, tags } = something as Row
  return (
    typeof title === "string" &&
    typeof url === "string" &&
    typeof tags === "string"
  )
}

const tagDelimiter = "|"

const options = { delimiter: ",", header: true, skipEmptyLines: true }

export function csvToTracks(text: string): {
  tracks: Track[]
  errors: CsvError[]
} {
  const results = Papa.parse<Row>(text, options)

  if (
    results.meta.fields === undefined ||
    results.meta.fields.length !== 3 ||
    results.meta.fields[0] !== "url" ||
    results.meta.fields[1] !== "title" ||
    results.meta.fields[2] !== "tags"
  ) {
    return { tracks: [], errors: [{ row: 0, errors: ["Invalid header"] }] }
  }

  const errors: CsvError[] = []
  const tracks: Track[] = []
  results.data.forEach((r, i) => {
    // add all existing csv errors to
    const errorList = {
      row: i + 1,
      errors: results.errors.filter(e => i === e.row).map(e => e.message),
    }

    // make sure its a row
    if (!isRow(r)) {
      errorList.errors.push("Not a valid row")
      errors.push(errorList)

      // no point continuing
      return
    }

    // check the track
    const { fixed, validation } = checkTrack({
      title: r.title,
      url: r.url,
      tags: r.tags === "" ? [] : r.tags.split(tagDelimiter),
    })

    if (validation) {
      errorList.errors.push(
        ...Object.values(validation).reduce<string[]>((result, v) => {
          if (v) {
            result.push(v)
          }
          return result
        }, []),
      )
      errors.push(errorList)
      return
    }

    tracks.push(fixed)
  })

  // don't return any tracks if there were errors
  if (errors.length > 0) {
    return { tracks: [], errors }
  }

  return { tracks, errors: [] }
}

export function TracksToCsv(tracks: Track[]): string {
  return Papa.unparse<Row>(
    tracks.map<Row>(r => ({
      url: r.url,
      title: r.title,
      tags: r.tags.join(tagDelimiter),
    })),
    options,
  )
}
