import {
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material"
import { useEffect, useReducer } from "react"
import { Track, emptyTrack } from "../../domain/track"
import { addTrackToLibrary } from "../../room/library"
import { checkTitle, checkTrack, checkUrl } from "../../shared/utils"

interface Props {
  onClose: () => void
  tagSuggestions: string[]
  track?: Track | null
}

interface State {
  track: Track
  titleError?: string
  urlError?: string
  readyToSave: boolean
}

enum ActionType {
  setTitle,
  checkTitle,
  setUrl,
  checkUrl,
  autoFillTitle,
  setTags,
  setTrack,
  checkReadyToSave,
}

type Action =
  | { type: ActionType.setTitle; payload: string }
  | { type: ActionType.checkTitle }
  | { type: ActionType.setUrl; payload: string }
  | { type: ActionType.checkUrl }
  | { type: ActionType.autoFillTitle }
  | { type: ActionType.setTags; payload: string[] }
  | { type: ActionType.setTrack; payload: Track }
  | { type: ActionType.checkReadyToSave }

// Helper function to safely extract a filename from a URL
function extractTitleFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    // Handle Dropbox URLs
    if (urlObj.hostname.includes("dropbox")) {
      const path = urlObj.pathname
      const filename = path.split("/").pop() || ""
      // Remove query params and URL encoding
      return decodeURIComponent(filename) || null
    }
    // For other URLs, try to extract the last path segment
    const path = urlObj.pathname
    const filename = path.split("/").pop() || ""
    if (filename && !filename.includes(".")) {
      return null // Skip if it's not file-like
    }
    return filename ? decodeURIComponent(filename) : null
  } catch {
    return null // Silently fail on invalid URL
  }
}

// Helper function to remove common file extensions
function removeExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "")
}

function reducer(state: State, action: Action): State {
  const { type } = action
  switch (type) {
    case ActionType.setTitle:
      return {
        ...state,
        track: {
          ...state.track,
          title: action.payload,
        },
        readyToSave: false,
      }
    case ActionType.checkTitle: {
      const { fixed, validation } = checkTitle(state.track.title)
      return {
        ...state,
        titleError: validation,
        track: {
          ...state.track,
          title: fixed,
        },
        readyToSave: false,
      }
    }
    case ActionType.setUrl:
      return {
        ...state,
        track: {
          ...state.track,
          url: action.payload,
        },
      }
    case ActionType.checkUrl: {
      const { fixed, validation } = checkUrl(state.track.url)
      return {
        ...state,
        urlError: validation,
        track: {
          ...state.track,
          url: fixed,
        },
        readyToSave: false,
      }
    }
    case ActionType.autoFillTitle: {
      // Only auto-fill if title is empty
      if (state.track.title.trim()) {
        return state
      }
      const extracted = extractTitleFromUrl(state.track.url)
      if (extracted) {
        const cleanTitle = removeExtension(extracted).trim()
        if (cleanTitle) {
          return {
            ...state,
            track: {
              ...state.track,
              title: cleanTitle,
            },
          }
        }
      }
      return state
    }
    case ActionType.setTags:
      return {
        ...state,
        track: {
          ...state.track,
          tags: action.payload,
        },
        readyToSave: false,
      }
    case ActionType.setTrack:
      return {
        ...state,
        titleError: undefined,
        urlError: undefined,
        track: action.payload,
        readyToSave: false,
      }
    case ActionType.checkReadyToSave:
      const { fixed, validation } = checkTrack(state.track)
      return {
        ...state,
        titleError: validation?.titleValidation,
        urlError: validation?.urlValidation,
        track: fixed,
        readyToSave: validation === undefined,
      }
    default:
      throw new Error("unknown reducer action")
  }
}

export function TrackDialog(props: Props) {
  const { onClose, tagSuggestions, track } = props

  const [state, dispatch] = useReducer(reducer, {
    track: emptyTrack(),
    readyToSave: false,
  })

  useEffect(() => {
    dispatch({ type: ActionType.setTrack, payload: track ?? emptyTrack() })
  }, [track])

  useEffect(() => {
    if (state.readyToSave) {
      addTrackToLibrary(state.track)
      onClose()
    }
  }, [state.readyToSave])

  return (
    <Dialog fullWidth open={track !== null} onClose={onClose}>
      <DialogTitle>{track ? "Edit Track" : "New Track"}</DialogTitle>
      <DialogContent>
        <Stack spacing={4}>
          <TextField
            error={state.urlError !== undefined}
            helperText={state.urlError}
            autoComplete="off"
            value={state.track.url}
            disabled={track !== undefined && track !== null}
            variant="standard"
            label="URL"
            onBlur={() => {
              dispatch({ type: ActionType.checkUrl })
              dispatch({ type: ActionType.autoFillTitle })
            }}
            onChange={e =>
              dispatch({ type: ActionType.setUrl, payload: e.target.value })
            }
            type="url"
          />
          <TextField
            error={state.titleError !== undefined}
            helperText={state.titleError}
            autoComplete="off"
            value={state.track.title}
            variant="standard"
            label="Title"
            onBlur={() => dispatch({ type: ActionType.checkTitle })}
            onChange={e =>
              dispatch({ type: ActionType.setTitle, payload: e.target.value })
            }
            type="text"
          />
          <Autocomplete
            value={state.track.tags}
            multiple
            freeSolo
            onChange={(_, v) =>
              dispatch({ type: ActionType.setTags, payload: v })
            }
            options={tagSuggestions}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option}
                  {...getItemProps({ index })}
                />
              ))
            }
            renderInput={params => (
              <TextField {...params} variant="standard" label="Tags" />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            dispatch({ type: ActionType.checkReadyToSave })
          }}
        >
          Save
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  )
}
