import PauseRoundedIcon from "@mui/icons-material/PauseRounded"
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded"
import StopRoundedIcon from "@mui/icons-material/StopRounded"
import { ButtonGroup, IconButton } from "@mui/material"
import { useMessage } from "./MessageProvider"
import { Action, pause, resume, stop } from "../mb"

export function ControlButtons() {
  const currentMessage = useMessage()
  console.log("React currentMessage", currentMessage);
  
  return (
    <ButtonGroup>
      <IconButton disabled={currentMessage === undefined} onClick={stop}>
        <StopRoundedIcon fontSize="large" />
      </IconButton>
      {currentMessage?.action === Action.Play ? (
        <IconButton onClick={pause}>
          <PauseRoundedIcon fontSize="large" />
        </IconButton>
      ) : (
        <IconButton
          onClick={currentMessage ? resume : undefined}
          disabled={currentMessage === undefined}
        >
          <PlayArrowRoundedIcon fontSize="large" />
        </IconButton>
      )}
    </ButtonGroup>
  )
}
