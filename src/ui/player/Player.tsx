import { Card, CardContent, CardHeader } from "@mui/material"
import { Audio } from "./Audio"
import { ControlButtons } from "./ControlButtons"
import { useMessage } from "../providers/MessageProvider"
import { GMOnly } from "../providers/RoleProvider"

interface Props {
  ready: boolean
  volume: number
  mute: boolean
}

export function Player(props: Props) {
  const currentMessage = useMessage()
  return (
    <Card
      sx={{ minWidth: "100%", marginBottom: 2, marginTop: 1 }}
      variant="elevation"
      raised
    >
      <CardHeader
        subheader={currentMessage?.track.title}
        subheaderTypographyProps={{
          noWrap: true,
          maxWidth: 225,
          color: undefined,
        }}
        action={
          <GMOnly>
            <ControlButtons />
          </GMOnly>
        }
      />
      <CardContent>
        <Audio {...props} />
      </CardContent>
    </Card>
  )
}
