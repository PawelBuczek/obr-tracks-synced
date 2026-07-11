import {
  Skeleton,
  Slider,
  Stack,
  Typography,
  useTheme,
} from "@mui/material"
import { SyntheticEvent, useEffect, useState } from "react"
import { Action, seekToOffset } from "../../room/mb"
import { getSeconds } from "../../shared/utils"
import { useMessage } from "../providers/MessageProvider"

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
  const currentMessage = useMessage()
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragValue, setDragValue] = useState(0)

  useEffect(() => {
    if (currentMessage) {
      // on pause, just set the progression and wait for unpause
      if (currentMessage.action === Action.Pause) {
        setProgress(currentMessage.offset % currentMessage.duration)
        return
      }

      // on play, update progress every second
      const id = setInterval(() => {
        setProgress(
          (currentMessage.offset + getSeconds(currentMessage.time)) %
            currentMessage.duration,
        )
      }, 1000)
      return () => clearInterval(id)
    }

    setProgress(0)
  }, [currentMessage])

  const handleSliderChange = (_event: Event, value: number | number[]) => {
    if (typeof value === "number" && currentMessage) {
      // Convert percentage (0-100) to seconds
      const seconds = (value / 100) * currentMessage.duration
      setDragValue(seconds)
    }
  }

  const handleSliderChangeCommitted = (
    _event: Event | SyntheticEvent,
    value: number | number[],
  ) => {
    if (typeof value === "number" && currentMessage) {
      try {
        // Convert percentage (0-100) to seconds
        const seconds = (value / 100) * currentMessage.duration
        seekToOffset(seconds)
      } catch (error) {
        console.error("Failed to seek:", error)
      }
      setIsDragging(false)
    }
  }

  const handleSliderMouseDown = () => {
    setIsDragging(true)
  }

  if (!currentMessage) {
    return <Skeleton variant="rounded" animation="wave" height={5} />
  }

  const displayedProgress = isDragging ? dragValue : progress
  const sliderValue =
    currentMessage.duration > 0
      ? (displayedProgress / currentMessage.duration) * 100
      : 0

  return (
    <Stack
      spacing={2}
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
        height: theme => theme.spacing(5),
      }}
    >
      <TimeTypography seconds={displayedProgress} />
      <Slider
        value={sliderValue}
        onChange={handleSliderChange}
        onChangeCommitted={handleSliderChangeCommitted}
        onMouseDown={handleSliderMouseDown}
        onTouchStart={handleSliderMouseDown}
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
