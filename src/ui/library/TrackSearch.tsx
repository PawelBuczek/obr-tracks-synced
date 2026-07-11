import { TextField } from "@mui/material"
import Fuse from "fuse.js"
import { useEffect, useMemo, useState } from "react"
import { Track } from "../../domain/track"

interface Props {
  trackLibrary: Track[]
  onSearch: (results: Fuse.FuseResult<Track>[]) => void
}

export function TrackSearch(props: Props) {
  const { trackLibrary, onSearch } = props
  const fuse = useMemo(() => {
    return new Fuse(trackLibrary, {
      includeMatches: true,
      includeScore: true,
      keys: ["title", "tags"],
      shouldSort: true,
      threshold: 0.2,
      findAllMatches: false,
    })
  }, [trackLibrary])

  const all = useMemo(() => {
    return trackLibrary.map<Fuse.FuseResult<Track>>((t, i) => ({
      item: t,
      refIndex: i,
    }))
  }, [trackLibrary])

  const [value, setValue] = useState("")
  useEffect(() => {
    setValue("")
    onSearch(all)
  }, [trackLibrary])

  return (
    <TextField
      autoComplete="off"
      label="Search"
      margin="normal"
      fullWidth={true}
      type={"search"}
      value={value}
      onChange={e => {
        setValue(e.target.value)

        // on empty, reset the list
        if (!e.target.value) {
          onSearch(all)
          return
        }

        // build a list of terms, filtering out blanks
        const terms = e.target.value
          .split(" ")
          .filter(e => e)
          .map(e => {
            return { tags: e }
          })

        // run the search
        const results = fuse.search({
          $or: [{ title: e.target.value }, { $and: terms }],
        })
        onSearch(results)
      }}
    />
  )
}
