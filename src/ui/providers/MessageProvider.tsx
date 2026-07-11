import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import { Message, Action, onMessage } from "../../room/mb"
import { Track } from "../../domain/track"
import { getSeconds } from "../../shared/utils"

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
      message.track.url === optimistic.track.url
    )
  }

  return false
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

  const visibleMessage =
    override?.kind === "none"
      ? undefined
      : override?.kind === "message"
        ? override.message
        : message

  const actions: OptimisticMessageActions = {
    optimisticPlay: track => {
      const base = visibleMessage
      setOverride({
        kind: "message",
        expiresAt: now() + optimisticWindowMs,
        message: {
          id: base?.id ?? "optimistic-play",
          time: new Date(),
          action: Action.Play,
          offset: base?.track.url === track.url ? base.offset : 0,
          duration: base?.track.url === track.url ? base.duration : 0,
          track,
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
