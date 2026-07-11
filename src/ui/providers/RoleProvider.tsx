import OBR, { Player } from "@owlbear-rodeo/sdk"
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"

export enum Role {
  GM,
  Player,
}

function stringToRole(value: "GM" | "PLAYER") {
  if (value === "GM") {
    return Role.GM
  }
  return Role.Player
}

const RoleContext = createContext<Role>(Role.Player)

export const useRole = () => useContext(RoleContext)

export function RoleProvider({ children }: { children?: ReactNode }) {
  const [role, setRole] = useState<Role>(Role.Player)
  useEffect(() => {
    const handlePlayerChange = (player: Player) => {
      setRole(stringToRole(player.role))
    }
    OBR.player.getRole().then(r => setRole(stringToRole(r)))
    return OBR.player.onChange(handlePlayerChange)
  }, [])
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

interface Props {
  gm?: ReactNode
  player?: ReactNode
}

export function WithRole(props: Props) {
  const { gm, player } = props
  const role = useRole()
  if (role === Role.GM) {
    return gm
  }
  return player
}

export function GMOnly({ children }: { children?: ReactNode }) {
  return <WithRole gm={children} />
}

export function PlayerOnly({ children }: { children?: ReactNode }) {
  return <WithRole player={children} />
}
