import { VolumeOffRounded, VolumeUpRounded } from "@mui/icons-material"
import { IconButton } from "@mui/material"
import { useEffect, useState } from "react"

interface Props {
  onMute: (mute: boolean) => void
}

export function MuteButton(props: Props) {
  const { onMute } = props

  const [mute, setMute] = useState(true)

  useEffect(() => {
    onMute(mute)
  }, [mute])

  return (
    <IconButton
      onClick={() => {
        setMute(m => !m)
      }}
    >
      {mute ? (
        <VolumeOffRounded color="error" />
      ) : (
        <VolumeUpRounded color="action" />
      )}
    </IconButton>
  )
}
