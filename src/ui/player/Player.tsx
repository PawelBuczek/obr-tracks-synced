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
      sx={{ minWidth: "100%", marginBottom: 1, marginTop: 0.5 }}
      variant="elevation"
      raised
    >
      <CardHeader
        sx={{ px: 2, py: 2 }}
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
      <CardContent sx={{ px: 2, pt: 0.5, pb: "8px !important" }}>
        <Audio {...props} />
      </CardContent>
    </Card>
  )
}
