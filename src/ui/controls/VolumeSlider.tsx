import { Slider } from "@mui/material"
import { useEffect, useState } from "react"
import { getVolume, setVolume } from "../../volume"

interface Props {
  onVolume: (volume: number) => void
  disabled: boolean
}

export function VolumeSlider(props: Props) {
  const { onVolume, disabled } = props
  const [value, setValue] = useState(getVolume() * 100)

  useEffect(() => {
    onVolume(getVolume())
  }, [])

  return (
    <Slider
      disabled={disabled}
      value={value}
      onChange={(_, v) => {
        setValue(v as number)
        const volume = (v as number) / 100
        onVolume(volume)
        setVolume(volume)
      }}
    />
  )
}
