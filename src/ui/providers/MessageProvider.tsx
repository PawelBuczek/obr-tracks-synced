import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import { Message, onMessage } from "../../mb"

const Context = createContext<Message | undefined>(undefined)

export const useMessage = () => useContext(Context)

export function MessageProvider({ children }: { children?: ReactNode }) {
  const [message, setMessage] = useState<Message | undefined>(undefined)
  useEffect(() => {
    return onMessage(setMessage)
  }, [])
  return <Context.Provider value={message}>{children}</Context.Provider>
}
