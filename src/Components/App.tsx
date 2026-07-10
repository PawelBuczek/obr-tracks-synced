import {
  AppBar,
  Box,
  Collapse,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material"
import OBR from "@owlbear-rodeo/sdk"
import Fuse from "fuse.js"
import { useEffect, useMemo, useState } from "react"
import { onLibraryChange } from "../library"
import { Track } from "../track"
import { ActionPopover } from "./ActionPopover"
import { Confirm, ConfirmPayload } from "./Confirm"
import { IconMenu } from "./IconMenu"
import { useMessage } from "./MessageProvider"
import { MuteButton } from "./MuteButton"
import { Player } from "./Player"
import { GMOnly, Role, WithRole, useRole } from "./RoleProvider"
import { TrackDialog } from "./TrackDialog"
import { TrackList } from "./TrackList"
import { TrackSearch } from "./TrackSearch"
import { VolumeSlider } from "./VolumeSlider"

export function App() {
  const currentMessage = useMessage()

  // role
  const role = useRole()

  // track library state
  const [trackLibrary, setTrackLibrary] = useState<Track[]>([])
  useEffect(() => {
    return onLibraryChange(setTrackLibrary)
  }, [])

  // track list state
  const [searchResults, setSearchResults] = useState<Fuse.FuseResult<Track>[]>(
    [],
  )

  // tag suggestions state for track dialog
  const tagSuggestions = useMemo<string[]>(() => {
    return [...new Set(trackLibrary.flatMap(track => track.tags))]
  }, [trackLibrary])

  // track dialog state
  const [trackDialogTrack, setTrackDialogTrack] = useState<
    Track | undefined | null
  >(null)
  const handleTrackDialogOpen = () => {
    setTrackDialogTrack(undefined)
  }
  const handleTrackDialogClose = () => {
    setTrackDialogTrack(null)
  }

  // confirm state
  const [confirmPayload, setConfirmPayload] = useState<
    ConfirmPayload | undefined
  >()

  // audio state
  const [ready, setReady] = useState(false)
  const [volume, setVolume] = useState(0)
  const [mute, setMute] = useState(true)
  const playerProps = { ready, volume, mute }

  // unmute reminder
  useEffect(() => {
    if (!ready) {
      const id = setTimeout(() => {
        OBR.notification.show("Don't forget to unmute your audio.", "WARNING")
      }, 30000)
      return () => clearTimeout(id)
    }
  }, [ready])

  return (
    <ActionPopover
      height={role === Role.GM ? 1000 : currentMessage !== undefined ? 173 : 48}
      badgeText={mute ? "🔇" : undefined}
      badgeColor="transparent"
    >
      <Box onClick={ready ? undefined : () => setReady(true)}>
        {/* toolbar */}
        <AppBar position="fixed">
          {/* menu, meader, and volume control */}
          <Toolbar variant="dense">
            <GMOnly>
              <IconMenu
                confirm={setConfirmPayload}
                openTrackDialog={handleTrackDialogOpen}
              />
            </GMOnly>
            <Typography variant="h5" sx={{ flexGrow: 1 }}>
              Tracks
            </Typography>

            <Stack spacing={0} direction="row" sx={{ alignItems: "center", flex: 9 }}>
              <VolumeSlider onVolume={setVolume} disabled={mute} />
              <MuteButton onMute={setMute} />
            </Stack>
          </Toolbar>

          {/* search bar */}
          <GMOnly>
            <Toolbar variant="dense">
              <TrackSearch
                trackLibrary={trackLibrary}
                onSearch={setSearchResults}
              />
            </Toolbar>
          </GMOnly>

          {/* player */}
          <WithRole
            gm={
              <Collapse in={currentMessage !== undefined}>
                <Toolbar variant="dense">
                  <Player {...playerProps} />
                </Toolbar>
              </Collapse>
            }
            player={
              <Toolbar variant="dense">
                <Player {...playerProps} />
              </Toolbar>
            }
          />
        </AppBar>

        {/* only the gm needs the rest of the app */}
        <GMOnly>
          {/* padding */}
          <Box sx={{ height: 48 }} />
          <Box sx={{ height: 80 }} />
          <Collapse in={currentMessage !== undefined}>
            <Box sx={{ height: 144 }} />
          </Collapse>

          <TrackDialog
            onClose={handleTrackDialogClose}
            tagSuggestions={tagSuggestions}
            track={trackDialogTrack}
          />
          <Confirm
            payload={confirmPayload}
            onClose={() => {
              setConfirmPayload(undefined)
            }}
          />
          <TrackList
            searchResults={searchResults}
            editTrack={setTrackDialogTrack}
            confirm={setConfirmPayload}
          />
        </GMOnly>
      </Box>
    </ActionPopover>
  )
}
