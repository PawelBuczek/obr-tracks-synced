import { key } from "./key"

const path = key("mute")
const fallback = true

export function getMute(): boolean {
  const data = localStorage.getItem(path)

  if (data === null) {
    return fallback
  }

  return data === "true"
}

export function setMute(mute: boolean) {
  localStorage.setItem(path, mute.toString())
}