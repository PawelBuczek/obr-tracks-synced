import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import { Message, Action, getCachedTrackOffset, onMessage } from "../../room/mb"
import { isSameTrack, Track } from "../../domain/track"
import { getPlaybackTime, getSeconds } from "../../shared/utils"
import { checkTrack, convertToDirectDownloadable } from "../../shared/utils"

const Context = createContext<Message | undefined>(undefined)

type OptimisticOverride =
  | {
      kind: "message"
      message: Message
      expiresAt: number
    }
  | {
      kind: "none"
      expiresAt: number
    }

interface OptimisticMessageActions {
  optimisticPlay: (track: Track) => void
  optimisticPause: () => void
  optimisticResume: () => void
  optimisticStop: () => void
}

const noop = () => undefined

const ActionsContext = createContext<OptimisticMessageActions>({
  optimisticPlay: noop,
  optimisticPause: noop,
  optimisticResume: noop,
  optimisticStop: noop,
})

function matchesCanonical(
  override: OptimisticOverride,
  message: Message | undefined,
): boolean {
  if (override.kind === "none") {
    return message === undefined
  }

  if (!message) {
    return false
  }

  const optimistic = override.message

  if (optimistic.action === Action.Play || optimistic.action === Action.Pause) {
    return (
      message.action === optimistic.action &&
      isSameTrack(message.track, optimistic.track)
    )
  }

  return false
}

function getMessageOffset(message: Message): number {
  if (message.action === Action.Play) {
    return getPlaybackTime(
      message.offset,
      getSeconds(message.time),
      message.duration,
    )
  }

  return message.offset
}

export const useMessage = () => useContext(Context)

export const useMessageOptimisticActions = () => useContext(ActionsContext)

export function MessageProvider({ children }: { children?: ReactNode }) {
  const [message, setMessage] = useState<Message | undefined>(undefined)
  const [override, setOverride] = useState<OptimisticOverride | undefined>(
    undefined,
  )

  useEffect(() => {
    return onMessage(setMessage)
  }, [])

  useEffect(() => {
    if (!override) {
      return
    }

    if (matchesCanonical(override, message)) {
      setOverride(undefined)
      return
    }

    const msUntilExpire = Math.max(0, override.expiresAt - Date.now())
    const timeoutId = setTimeout(() => {
      setOverride(undefined)
    }, msUntilExpire)

    return () => clearTimeout(timeoutId)
  }, [override, message])

  const optimisticWindowMs = 2000
  const now = () => Date.now()

  const normalizeTrackForOptimisticPlay = (track: Track): Track | undefined => {
    const { fixed, validation } = checkTrack(track)
    if (validation) {
      return undefined
    }

    try {
      return {
        ...fixed,
        url: convertToDirectDownloadable(fixed.url),
      }
    } catch {
      return undefined
    }
  }

  const visibleMessage =
    override?.kind === "none"
      ? undefined
      : override?.kind === "message"
        ? override.message
        : message

  const actions: OptimisticMessageActions = {
    optimisticPlay: track => {
      const normalizedTrack = normalizeTrackForOptimisticPlay(track)
      if (!normalizedTrack) {
        return
      }

      const base = visibleMessage
      const isSameAsCurrent =
        base?.track !== undefined && isSameTrack(base.track, normalizedTrack)
      const cachedOffset = getCachedTrackOffset(normalizedTrack.url)

      setOverride({
        kind: "message",
        expiresAt: now() + optimisticWindowMs,
        message: {
          id: base?.id ?? "optimistic-play",
          time: new Date(),
          action: Action.Play,
          offset: isSameAsCurrent
            ? getMessageOffset(base)
            : cachedOffset ?? 0,
          duration:
            isSameAsCurrent ? base.duration : 0,
          track: normalizedTrack,
        },
      })
    },
    optimisticPause: () => {
      const base = visibleMessage
      if (!base) {
        return
      }

      const offset =
        base.action === Action.Play
          ? base.offset + getSeconds(base.time)
          : base.offset

      setOverride({
        kind: "message",
        expiresAt: now() + optimisticWindowMs,
        message: {
          ...base,
          action: Action.Pause,
          time: new Date(),
          offset,
        },
      })
    },
    optimisticResume: () => {
      const base = visibleMessage
      if (!base) {
        return
      }

      setOverride({
        kind: "message",
        expiresAt: now() + optimisticWindowMs,
        message: {
          ...base,
          action: Action.Play,
          time: new Date(),
        },
      })
    },
    optimisticStop: () => {
      setOverride({
        kind: "none",
        expiresAt: now() + optimisticWindowMs,
      })
    },
  }

  return (
    <ActionsContext.Provider value={actions}>
      <Context.Provider value={visibleMessage}>{children}</Context.Provider>
    </ActionsContext.Provider>
  )
}
