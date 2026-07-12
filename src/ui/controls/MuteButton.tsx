import { VolumeOffRounded, VolumeUpRounded } from "@mui/icons-material"
import { IconButton } from "@mui/material"

interface Props {
  mute: boolean
  onMute: (mute: boolean) => void
}

export function MuteButton(props: Props) {
  const { mute, onMute } = props

  return (
    <IconButton
      onClick={() => {
        onMute(!mute)
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
