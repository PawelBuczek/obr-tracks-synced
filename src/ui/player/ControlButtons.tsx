import PauseRoundedIcon from "@mui/icons-material/PauseRounded"
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded"
import StopRoundedIcon from "@mui/icons-material/StopRounded"
import { ButtonGroup, IconButton } from "@mui/material"
import { Action, pause, resume, stop } from "../../room/mb"
import {
  useMessage,
  useMessageOptimisticActions,
} from "../providers/MessageProvider"

export function ControlButtons() {
  const currentMessage = useMessage()
  const { optimisticPause, optimisticResume, optimisticStop } =
    useMessageOptimisticActions()
  console.log("React currentMessage", currentMessage)

  return (
    <ButtonGroup>
      <IconButton
        disabled={currentMessage === undefined}
        onClick={() => {
          optimisticStop()
          stop()
        }}
      >
        <StopRoundedIcon fontSize="large" />
      </IconButton>
      {currentMessage?.action === Action.Play ? (
        <IconButton
          onClick={() => {
            optimisticPause()
            pause()
          }}
        >
          <PauseRoundedIcon fontSize="large" />
        </IconButton>
      ) : (
        <IconButton
          onClick={
            currentMessage
              ? () => {
                  optimisticResume()
                  resume()
                }
              : undefined
          }
          disabled={currentMessage === undefined}
        >
          <PlayArrowRoundedIcon fontSize="large" />
        </IconButton>
      )}
    </ButtonGroup>
  )
}
