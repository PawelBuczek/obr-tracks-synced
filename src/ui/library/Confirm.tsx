import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material"

export interface ConfirmPayload {
  message: string
  action: () => void
}

interface Props {
  payload?: ConfirmPayload
  onClose: () => void
}

export function Confirm(props: Props) {
  const { payload, onClose } = props
  return (
    <Dialog open={payload !== undefined} onClose={onClose}>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogContent>
        <DialogContentText>{payload?.message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            payload?.action()
            onClose()
          }}
        >
          Confirm
        </Button>
        <Button
          autoFocus
          onClick={() => {
            onClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
