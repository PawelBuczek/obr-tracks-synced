import {
  AppBar,
  Box,
  Button,
  Card,
  CardHeader,
  Collapse,
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
            onClick={() => setIsPlaying(true)}
          >
            Start Track One
          </Button>
        </Toolbar>

        <Collapse in={isPlaying}>
          <Toolbar variant="dense">
            <Card data-testid="player" sx={{ minWidth: "100%", marginBottom: 2, marginTop: 1 }}>
              <CardHeader subheader="Track One" />
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
        {tracks.map(track => (
          <ListItem key={track.url} component="div" data-testid="track-item">
            {track.title}
          </ListItem>
        ))}
      </List>
    </Box>
  )
}