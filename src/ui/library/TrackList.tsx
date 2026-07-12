import {
  IconButton,
  Card,
  CardActionArea,
  CardContent,
  CardHeader,
  Chip,
  ListItem,
  Menu,
  MenuItem,
  Stack,
} from "@mui/material"
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded"
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded"
import Fuse from "fuse.js"
import { useState } from "react"
import { Track } from "../../domain/track"
import { getTrackListClickAction } from "../../domain/trackListActions"
import { deleteTrackFromLibrary } from "../../room/library"
import { pause, play, resume } from "../../room/mb"
import {
  useMessage,
  useMessageOptimisticActions,
} from "../providers/MessageProvider"
import { ConfirmPayload } from "./Confirm"

interface TrackCardProps {
  track: Track
  editTrack: (track: Track) => void
  confirm: (payload: ConfirmPayload) => void
  canMoveUp: boolean
  canMoveDown: boolean
  moveUp: (track: Track) => void
  moveDown: (track: Track) => void
  matches?: ReadonlyArray<Fuse.FuseResultMatch>
}

function TrackCard(props: TrackCardProps) {
  const {
    track,
    editTrack,
    confirm,
    canMoveUp,
    canMoveDown,
    moveUp,
    moveDown,
    matches,
  } = props
  const currentMessage = useMessage()
  const { optimisticPause, optimisticResume } = useMessageOptimisticActions()
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number
    mouseY: number
  } | null>(null)

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
          }
        : null,
    )
  }

  const handleClose = () => {
    setContextMenu(null)
  }

  const chips = track.tags.map((t, i) => (
    <Chip
      key={i}
      variant="outlined"
      label={t}
      color={
        matches?.find(m => m.key === "tags" && m.refIndex === i)
          ? "secondary"
          : undefined
      }
    />
  ))

  const handleTrackClick = () => {
    switch (getTrackListClickAction(track, currentMessage)) {
      case "resume":
        optimisticResume()
        resume()
        return
      case "pause":
        optimisticPause()
        pause()
        return
      default:
        play(track)
    }
  }

  return (
    <Card sx={{ minWidth: "100%" }} onContextMenu={handleContextMenu}>
      <CardActionArea disableRipple={false} onClick={handleTrackClick}>
        <CardHeader
          subheader={track.title}
          action={
            <Stack direction="column" spacing={0}>
              <IconButton
                size="small"
                aria-label={`Move ${track.title} up`}
                disabled={!canMoveUp}
                onClick={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  moveUp(track)
                }}
              >
                <ArrowUpwardRoundedIcon fontSize="inherit" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={`Move ${track.title} down`}
                disabled={!canMoveDown}
                onClick={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  moveDown(track)
                }}
              >
                <ArrowDownwardRoundedIcon fontSize="inherit" />
              </IconButton>
            </Stack>
          }
          subheaderTypographyProps={{
            color: matches?.find(
              m => m.key === "title" && m.value === track.title,
            )
              ? "secondary"
              : undefined,
          }}
        />
        {chips.length > 0 && <CardContent>{chips}</CardContent>}
      </CardActionArea>
      <Menu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem
          onClick={() => {
            editTrack(track)
            handleClose()
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            confirm({
              message: `This will delete ${track.title} from your library`,
              action: () => {
                deleteTrackFromLibrary(track)
                handleClose()
              },
            })
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </Card>
  )
}

interface Props {
  searchResults: Fuse.FuseResult<Track>[]
  editTrack: (track: Track) => void
  confirm: (payload: ConfirmPayload) => void
  moveTrackUp: (track: Track) => void
  moveTrackDown: (track: Track) => void
}

export function TrackList(props: Props) {
  const { editTrack, searchResults, confirm, moveTrackUp, moveTrackDown } = props

  return (
    <>
      {searchResults.map((result, index) => (
        <ListItem key={result.item.url} component="div">
          <TrackCard
            track={result.item}
            editTrack={editTrack}
            confirm={confirm}
            canMoveUp={index > 0}
            canMoveDown={index < searchResults.length - 1}
            moveUp={moveTrackUp}
            moveDown={moveTrackDown}
            matches={result.matches}
          />
        </ListItem>
      ))}
    </>
  )
}
