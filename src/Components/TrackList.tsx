import {
  Card,
  CardActionArea,
  CardContent,
  CardHeader,
  Chip,
  ListItem,
  Menu,
  MenuItem,
} from "@mui/material"
import Fuse from "fuse.js"
import { useState } from "react"
import { Virtuoso } from "react-virtuoso"
import { ConfirmPayload } from "./Confirm"
import { deleteTrackFromLibrary } from "../library"
import { pause, play, resume } from "../mb"
import { Track } from "../track"
import { useMessage } from "./MessageProvider"
import { getTrackListClickAction } from "../trackListActions"

interface TrackCardProps {
  track: Track
  editTrack: (track: Track) => void
  confirm: (payload: ConfirmPayload) => void
  matches?: ReadonlyArray<Fuse.FuseResultMatch>
}

function TrackCard(props: TrackCardProps) {
  const { track, editTrack, confirm, matches } = props
  const currentMessage = useMessage()
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
        : // repeated contextmenu when it is already open closes it with Chrome 84 on Ubuntu
          // Other native context menus might behave different.
          // With this behavior we prevent contextmenu from the backdrop to re-locale existing context menus.
          null,
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
        resume()
        return
      case "pause":
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
}

export function TrackList(props: Props) {
  const { editTrack, searchResults, confirm } = props
  return (
    <Virtuoso
      useWindowScroll
      data={searchResults}
      itemContent={(_, result) => (
        <ListItem component={"div"}>
          <TrackCard
            key={result.item.url}
            track={result.item}
            editTrack={editTrack}
            confirm={confirm}
            matches={result.matches}
          />
        </ListItem>
      )}
    />
  )
}
