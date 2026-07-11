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
import { addTrackToLibrary } from "../../library"
import { Track, emptyTrack } from "../../track"
import { checkTitle, checkTrack, checkUrl } from "../../utils"

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
  setTags,
  setTrack,
  checkReadyToSave,
}

type Action =
  | { type: ActionType.setTitle; payload: string }
  | { type: ActionType.checkTitle }
  | { type: ActionType.setUrl; payload: string }
  | { type: ActionType.checkUrl }
  | { type: ActionType.setTags; payload: string[] }
  | { type: ActionType.setTrack; payload: Track }
  | { type: ActionType.checkReadyToSave }

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
          <TextField
            error={state.urlError !== undefined}
            helperText={state.urlError}
            autoComplete="off"
            value={state.track.url}
            disabled={track !== undefined && track !== null}
            variant="standard"
            label="Url"
            onBlur={() => dispatch({ type: ActionType.checkUrl })}
            onChange={e =>
              dispatch({ type: ActionType.setUrl, payload: e.target.value })
            }
            type="url"
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
