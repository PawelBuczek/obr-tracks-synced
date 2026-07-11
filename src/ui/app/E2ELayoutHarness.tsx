import {
  AppBar,
  Box,
  Button,
  Card,
  CardHeader,
  Collapse,
  LinearProgress,
  List,
  ListItem,
  Toolbar,
  Typography,
} from "@mui/material"
import { useMemo, useState } from "react"

export function E2ELayoutHarness() {
  const tracks = useMemo(
    () => [
      { title: "Track One", url: "https://example.com/one.mp3" },
      { title: "Track Two", url: "https://example.com/two.mp3" },
    ],
    [],
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [activeTrackIndex, setActiveTrackIndex] = useState(0)
  const [switchingToIndex, setSwitchingToIndex] = useState<number | undefined>(
    undefined,
  )

  const startPlayback = () => {
    setActiveTrackIndex(0)
    setIsPlaying(true)
  }

  const switchTrack = (nextIndex: number) => {
    if (!isPlaying || nextIndex === activeTrackIndex || switchingToIndex !== undefined) {
      return
    }

    // Simulate canonical room commit delay during track switch.
    setSwitchingToIndex(nextIndex)
    setTimeout(() => {
      setActiveTrackIndex(nextIndex)
      setSwitchingToIndex(undefined)
    }, 350)
  }

  return (
    <Box>
      <AppBar position="fixed">
        <Toolbar variant="dense">
          <Typography variant="h5" sx={{ flexGrow: 1 }}>
            Tracks
          </Typography>
          <Button
            color="inherit"
            variant="outlined"
            data-testid="start-playback"
            onClick={startPlayback}
          >
            Start Track One
          </Button>
        </Toolbar>

        <Collapse in={isPlaying}>
          <Toolbar variant="dense">
            <Card data-testid="player" sx={{ minWidth: "100%", marginBottom: 2, marginTop: 1 }}>
              <CardHeader
                subheader={tracks[activeTrackIndex].title}
                slotProps={{
                  subheader: {
                    "data-testid": "player-title",
                  },
                }}
              />
              {switchingToIndex !== undefined && (
                <LinearProgress data-testid="player-switching" />
              )}
            </Card>
          </Toolbar>
        </Collapse>
      </AppBar>

      <Box sx={{ height: 48 }} />
      <Box sx={{ height: 80 }} />
      <Collapse in={isPlaying}>
        <Box sx={{ height: 144 }} data-testid="player-spacer" />
      </Collapse>

      <List data-testid="track-list">
        {tracks.map((track, index) => (
          <ListItem
            key={track.url}
            component="div"
            data-testid="track-item"
            sx={{ gap: 1 }}
          >
            <Typography sx={{ flexGrow: 1 }}>{track.title}</Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => switchTrack(index)}
              data-testid={`switch-to-track-${index + 1}`}
              disabled={!isPlaying || index === activeTrackIndex || switchingToIndex !== undefined}
            >
              Play
            </Button>
          </ListItem>
        ))}
      </List>
    </Box>
  )
}