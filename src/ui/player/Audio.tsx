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
  const muteRef = useRef(mute)

  useEffect(() => {
    muteRef.current = mute
    if (ref.current) {
      ref.current.muted = mute
    }
  }, [mute])

  useEffect(() => {
    if (ref.current) {
      ref.current.volume = volume
    }
  }, [volume])

  const playWithAutoplayFallback = (audio: HTMLAudioElement) => {
    if (!audio.paused) {
      return
    }

    const playPromise = audio.play()

    if (!playPromise || typeof playPromise.then !== "function") {
      return
    }

    void playPromise.catch(() => {
      if (muteRef.current) {
        return
      }

      audio.muted = true
      const retryPromise = audio.play()

      if (!retryPromise || typeof retryPromise.then !== "function") {
        audio.muted = muteRef.current
        return
      }

      void retryPromise.finally(() => {
        audio.muted = muteRef.current
      })
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

        playWithAutoplayFallback(ref.current)
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
  }, [ready, currentMessage, volume])

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
