import SortByAlphaRoundedIcon from "@mui/icons-material/SortByAlphaRounded"
import { IconButton, Stack, TextField, Tooltip } from "@mui/material"
import Fuse from "fuse.js"
import { useEffect, useMemo, useState } from "react"
import { LibrarySortMode } from "../../room/metadataSchema"
import { Track } from "../../domain/track"

interface Props {
  trackLibrary: Track[]
  onSearch: (results: Fuse.FuseResult<Track>[]) => void
  sortMode: LibrarySortMode
  onCycleSortMode: () => void
}

function sortModeLabel(mode: LibrarySortMode): string {
  switch (mode) {
    case LibrarySortMode.Ascending:
      return "Ascending"
    case LibrarySortMode.Descending:
      return "Descending"
    default:
      return "Not sorted"
  }
}

function sortResults(
  results: Fuse.FuseResult<Track>[],
  mode: LibrarySortMode,
): Fuse.FuseResult<Track>[] {
  if (mode === LibrarySortMode.NotSorted) {
    return results
  }

  const sorted = [...results].sort((left, right) =>
    left.item.title.localeCompare(right.item.title, undefined, {
      sensitivity: "base",
    }),
  )

  return mode === LibrarySortMode.Descending ? sorted.reverse() : sorted
}

function sortModeButtonSx(mode: LibrarySortMode) {
  switch (mode) {
    case LibrarySortMode.Ascending:
      return {
        color: "success.main",
        bgcolor: "success.light",
      }
    case LibrarySortMode.Descending:
      return {
        color: "warning.dark",
        bgcolor: "warning.light",
      }
    default:
      return {
        color: "inherit",
        bgcolor: "transparent",
      }
  }
}

export function TrackSearch(props: Props) {
  const { trackLibrary, onSearch, sortMode, onCycleSortMode } = props
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
    const query = value.trim()

    if (!query) {
      onSearch(sortResults(all, sortMode))
      return
    }

    const terms = query
      .split(" ")
      .filter(e => e)
      .map(e => {
        return { tags: e }
      })

    const results = fuse.search({
      $or: [{ title: query }, { $and: terms }],
    })

    onSearch(sortResults(results, sortMode))
  }, [all, fuse, onSearch, sortMode, value])

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "center", width: "100%", minWidth: 0 }}
    >
      <TextField
        sx={{ flex: 1, minWidth: 0 }}
        autoComplete="off"
        label="Search"
        margin="normal"
        fullWidth={true}
        type={"search"}
        value={value}
        onChange={e => {
          setValue(e.target.value)
        }}
      />
      <Tooltip
        title={`sort alphabetically. Current mode: ${sortModeLabel(sortMode)}`}
        enterDelay={500}
      >
        <IconButton
          aria-label={`Toggle alphabetical sort. Current mode: ${sortModeLabel(sortMode)}`}
          onClick={onCycleSortMode}
          sx={{ ...sortModeButtonSx(sortMode), flexShrink: 0 }}
        >
          <SortByAlphaRoundedIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  )
}
