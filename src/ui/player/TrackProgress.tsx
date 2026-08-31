import {
  Skeleton,
  Slider,
  Stack,
  Typography,
  useTheme,
} from "@mui/material"
import { SyntheticEvent, useEffect, useState } from "react"
import { canonicalizeTrackUrl, Track, isSameTrack } from "../../domain/track"
import { Action, broadcastSeekPreview, onSeekPreview, seekToOffset } from "../../room/mb"
import { getPlaybackTime, getSeconds } from "../../shared/utils"
import { useMessage } from "../providers/MessageProvider"
import { Role, useRole } from "../providers/RoleProvider"

function secondsToDisplay(seconds: number): string {
  // Safety check for invalid values
  if (!Number.isFinite(seconds)) {
    return "00:00:00"
  }
  return new Date(Math.max(0, seconds) * 1000).toISOString().substring(11, 19)
}

function TimeTypography(props: { seconds: number }) {
  const theme = useTheme()
  return (
    <Typography variant="caption" color={theme.palette.grey[400]}>
      {secondsToDisplay(props.seconds)}
    </Typography>
  )
}

export function TrackProgress() {
  const optimisticSeekWindowMs = 2000
  const remotePreviewWindowMs = 2000
  const currentMessage = useMessage()
  const role = useRole()
  const canSeek = role === Role.GM
  const [progress, setProgress] = useState(0)
  const [dragValue, setDragValue] = useState<number | undefined>(undefined)
  const [optimisticSeek, setOptimisticSeek] = useState<
    { seconds: number; expiresAt: number; track: Track } | undefined
  >(undefined)
  // Live scrub position broadcast by whichever client (GM) is currently dragging the slider.
  const [remotePreview, setRemotePreview] = useState<
    { seconds: number; trackUrl: string; expiresAt: number } | undefined
  >(undefined)

  useEffect(() => {
    if (currentMessage) {
      // on pause, just set the progression and wait for unpause
      if (currentMessage.action === Action.Pause) {
        setProgress(
          getPlaybackTime(currentMessage.offset, 0, currentMessage.duration),
        )
        return
      }

      // on play, sync immediately and then keep updating every second
      const updateProgress = () => {
        setProgress(
          getPlaybackTime(
            currentMessage.offset,
            getSeconds(currentMessage.time),
            currentMessage.duration,
          ),
        )
      }

      updateProgress()

      // on play, update progress every second
      const id = setInterval(() => {
        updateProgress()
      }, 1000)
      return () => clearInterval(id)
    }

    setProgress(0)
  }, [currentMessage])

  useEffect(() => {
    if (!optimisticSeek) {
      return
    }

    const msUntilExpire = Math.max(0, optimisticSeek.expiresAt - Date.now())
    const timeoutId = setTimeout(() => {
      setOptimisticSeek(undefined)
    }, msUntilExpire)

    return () => clearTimeout(timeoutId)
  }, [optimisticSeek])

  useEffect(() => {
    return onSeekPreview(message => {
      setRemotePreview({
        seconds: message.offsetSeconds,
        trackUrl: message.trackUrl,
        expiresAt: Date.now() + remotePreviewWindowMs,
      })
    })
  }, [])

  useEffect(() => {
    if (!remotePreview) {
      return
    }

    const msUntilExpire = Math.max(0, remotePreview.expiresAt - Date.now())
    const timeoutId = setTimeout(() => {
      setRemotePreview(undefined)
    }, msUntilExpire)

    return () => clearTimeout(timeoutId)
  }, [remotePreview])

  useEffect(() => {
    if (!currentMessage || !remotePreview) {
      return
    }

    if (canonicalizeTrackUrl(currentMessage.track.url) !== remotePreview.trackUrl) {
      setRemotePreview(undefined)
    }
  }, [currentMessage, remotePreview])

  useEffect(() => {
    if (!currentMessage || !optimisticSeek) {
      return
    }

    if (!isSameTrack(currentMessage.track, optimisticSeek.track)) {
      setOptimisticSeek(undefined)
      return
    }

    const syncedProgress =
      currentMessage.action === Action.Pause
        ? getPlaybackTime(currentMessage.offset, 0, currentMessage.duration)
        : getPlaybackTime(
            currentMessage.offset,
            getSeconds(currentMessage.time),
            currentMessage.duration,
          )

    if (Math.abs(syncedProgress - optimisticSeek.seconds) <= 1) {
      setOptimisticSeek(undefined)
    }
  }, [currentMessage, optimisticSeek])

  const handleSliderChange = (_event: Event, value: number | number[]) => {
    if (!canSeek) {
      return
    }

    if (typeof value === "number" && currentMessage) {
      // Convert percentage (0-100) to seconds
      const seconds = (value / 100) * currentMessage.duration
      setDragValue(seconds)
      broadcastSeekPreview(seconds)
    }
  }

  const handleSliderChangeCommitted = (
    _event: Event | SyntheticEvent,
    value: number | number[],
  ) => {
    if (!canSeek) {
      setDragValue(undefined)
      return
    }

    if (typeof value === "number" && currentMessage) {
      // Convert percentage (0-100) to seconds
      const seconds = (value / 100) * currentMessage.duration
      setProgress(seconds)
      setOptimisticSeek({
        seconds,
        expiresAt: Date.now() + optimisticSeekWindowMs,
        track: currentMessage.track,
      })
      setDragValue(undefined)

      void seekToOffset(seconds).catch(error => {
        console.error("Failed to seek:", error)
      })
      return
    }

    setDragValue(undefined)
  }

  if (!currentMessage) {
    return <Skeleton variant="rounded" animation="wave" height={5} />
  }

  const displayedProgress =
    dragValue ?? optimisticSeek?.seconds ?? remotePreview?.seconds ?? progress
  const sliderValue =
    currentMessage.duration > 0
      ? (displayedProgress / currentMessage.duration) * 100
      : 0

  return (
    <Stack
      spacing={1}
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
        py: 0.25,
      }}
    >
      <TimeTypography seconds={displayedProgress} />
      <Slider
        value={sliderValue}
        onChange={handleSliderChange}
        onChangeCommitted={handleSliderChangeCommitted}
        disabled={!canSeek}
        min={0}
        max={100}
        step={0.1}
        sx={{
          flex: 1,
          "& .MuiSlider-thumb": {
            width: 12,
            height: 12,
          },
        }}
      />
      <TimeTypography seconds={currentMessage.duration} />
    </Stack>
  )
}
