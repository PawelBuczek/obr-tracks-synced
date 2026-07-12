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
import {
  getLibrarySortMode,
  moveTrackDownInLibrary,
  moveTrackUpInLibrary,
  onLibrarySortModeChange,
  onLibraryChange,
  setLibrarySortMode,
} from "../../room/library"
import { LibrarySortMode } from "../../room/metadataSchema"
import { Track } from "../../domain/track"
import { setMute as persistMute } from "../../shared/mute"
import { getVolume, setVolume as persistVolume } from "../../shared/volume"
import { ActionPopover, MuteButton, VolumeSlider } from "../controls"
import {
  Confirm,
  ConfirmPayload,
  IconMenu,
  TrackDialog,
  TrackList,
  TrackSearch,
} from "../library"
import { Player } from "../player"
import { GMOnly, Role, useMessage, useRole, WithRole } from "../providers"

export function App() {
  const gmPlayerSpacerHeight = 120

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
  const [sortMode, setSortMode] = useState<LibrarySortMode>(() =>
    getLibrarySortMode(),
  )

  useEffect(() => {
    return onLibrarySortModeChange(setSortMode)
  }, [])

  const cycleSortMode = () => {
    switch (sortMode) {
      case LibrarySortMode.NotSorted:
        setLibrarySortMode(LibrarySortMode.Ascending)
        return
      case LibrarySortMode.Ascending:
        setLibrarySortMode(LibrarySortMode.Descending)
        return
      default:
        setLibrarySortMode(LibrarySortMode.NotSorted)
    }
  }

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
  const [volume, setVolume] = useState(() => getVolume())
  const [mute, setMute] = useState(true)
  const playerProps = { ready, volume, mute }

  useEffect(() => {
    if (!ready && currentMessage !== undefined) {
      setReady(true)
    }
  }, [ready, currentMessage])

  useEffect(() => {
    persistVolume(volume)
  }, [volume])

  useEffect(() => {
    persistMute(mute)
  }, [mute])

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
              <VolumeSlider volume={volume} onVolume={setVolume} disabled={mute} />
              <MuteButton mute={mute} onMute={setMute} />
            </Stack>
          </Toolbar>

          {/* search bar */}
          <GMOnly>
            <Toolbar variant="dense">
              <TrackSearch
                trackLibrary={trackLibrary}
                onSearch={setSearchResults}
                sortMode={sortMode}
                onCycleSortMode={cycleSortMode}
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
            <Box sx={{ height: gmPlayerSpacerHeight }} />
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
            moveTrackUp={moveTrackUpInLibrary}
            moveTrackDown={moveTrackDownInLibrary}
            canReorder={sortMode === LibrarySortMode.NotSorted}
          />
        </GMOnly>
      </Box>
    </ActionPopover>
  )
}
