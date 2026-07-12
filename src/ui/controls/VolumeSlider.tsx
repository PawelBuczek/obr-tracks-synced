import { Slider } from "@mui/material"

interface Props {
  volume: number
  onVolume: (volume: number) => void
  disabled: boolean
}

export function VolumeSlider(props: Props) {
  const { volume, onVolume, disabled } = props

  return (
    <Slider
      disabled={disabled}
      value={volume * 100}
      onChange={(_, v) => {
        onVolume((v as number) / 100)
      }}
    />
  )
}
