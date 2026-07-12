import { useEffect, useRef } from "react"
import { Action } from "../../room/mb"
import { getPlaybackTime, getSeconds } from "../../shared/utils"
import { useMessage } from "../providers/MessageProvider"
import { TrackProgress } from "./TrackProgress"

interface AudioProps {
  ready: boolean
  volume: number
  mute: boolean
}

export function Audio(props: AudioProps) {
  const { ready, volume, mute } = props
  const currentMessage = useMessage()

  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.muted = mute
    }
  }, [mute])

  useEffect(() => {
    if (ref.current) {
      ref.current.volume = volume
    }
  }, [volume])

  const playIfNeeded = (audio: HTMLAudioElement) => {
    if (!audio.paused) {
      return
    }

    const playPromise = audio.play()

    if (!playPromise || typeof playPromise.then !== "function") {
      return
    }

    void playPromise.catch(() => {
      // Browser blocked autoplay; playback will start after user interaction.
    })
  }

  useEffect(() => {
    if (!ref.current || !ready) {
      return
    }

    // fix for startup audio sync
    ref.current.volume = volume

    if (!currentMessage) {
      ref.current.pause()
      ref.current.currentTime = 0
      return
    }

    switch (currentMessage.action) {
      case Action.Play:
        ref.current.currentTime = getPlaybackTime(
          currentMessage.offset,
          getSeconds(currentMessage.time),
          currentMessage.duration,
        )

        playIfNeeded(ref.current)
        break

      case Action.Pause:
        ref.current.currentTime = getPlaybackTime(
          currentMessage.offset,
          0,
          currentMessage.duration,
        )

        ref.current.paused || ref.current.pause()
        break
    }
  }, [ready, currentMessage, mute, volume])

  return (
    <>
      <audio
        id="tracks-audio-player"
        ref={ref}
        src={currentMessage ? currentMessage.track.url : ""}
        autoPlay={false}
        preload="auto"
        controls={false}
        loop={true}
      />
      <TrackProgress />
    </>
  )
}
