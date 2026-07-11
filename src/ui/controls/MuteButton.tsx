import { VolumeOffRounded, VolumeUpRounded } from "@mui/icons-material"
import { IconButton } from "@mui/material"
import { useEffect, useState } from "react"
import { getMute, setMute as persistMute } from "../../shared/mute"

interface Props {
  onMute: (mute: boolean) => void
}

export function MuteButton(props: Props) {
  const { onMute } = props

  const [mute, setMute] = useState(getMute())

  useEffect(() => {
    onMute(mute)
    persistMute(mute)
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
