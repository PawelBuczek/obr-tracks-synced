import {
  LinearProgress,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material"
import { useEffect, useState } from "react"
import { Action } from "../mb"
import { getSeconds } from "../utils"
import { useMessage } from "./MessageProvider"

function secondsToDisplay(seconds: number): string {
  return new Date(seconds * 1000).toISOString().substring(11, 19)
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

  if (!currentMessage) {
    return <Skeleton variant="rounded" animation="wave" height={5} />
  }

  return (
    <Stack
      spacing={2}
      direction="row"
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
        height: (theme) => theme.spacing(5),
      }}
    >
      <TimeTypography seconds={progress} />
      <LinearProgress
        variant="determinate"
        value={
          currentMessage.duration > 0
            ? (progress / currentMessage.duration) * 100
            : 0
        }
        sx={{ flex: 1 }}
      />
      <TimeTypography seconds={currentMessage.duration} />
    </Stack>
  )
}
