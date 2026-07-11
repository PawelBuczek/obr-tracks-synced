import { key } from "./key"

const path = key("volume")
const fallback = 0.3

export function getVolume(): number {
  const data = localStorage.getItem(path) ?? ""
  const volume = parseFloat(data)
  if (Number.isNaN(volume) || volume > 1) {
    return fallback
  }
  return volume
}

export function setVolume(volume: number) {
  if (volume > 1) {
    return
  }
  localStorage.setItem(path, volume.toString())
}
