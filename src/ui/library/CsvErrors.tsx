import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded"
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  useTheme,
} from "@mui/material"
import { CsvError } from "../../io/csv"

interface Props {
  errors: CsvError[]
  onClose(): void
}

export function CsvErrors(props: Props) {
  const { errors, onClose } = props
  const theme = useTheme()
  return (
    <Dialog fullWidth open={errors.length > 0} onClose={onClose}>
      <DialogTitle sx={{ flexGrow: 1 }}>
        <Stack direction={"row"} spacing={1} sx={{ alignItems: "center" }}>
          <ErrorOutlineRoundedIcon color="error" />
          <div>CSV Issues</div>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ overflowY: "unset" }}>
        <DialogContentText variant="subtitle2">
          The following <b>rows numbers</b> have errors which prevent importing.
          Please fix them and try again.
        </DialogContentText>
      </DialogContent>
      <DialogContent
        sx={{
          paddingY: 0,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Table sx={{ minWidth: "100%" }}>
          <TableBody>
            {errors.map(e => (
              <TableRow
                key={e.row}
                sx={{
                  "&:last-child td, &:last-child th": { border: 0 },
                }}
              >
                <TableCell padding="checkbox">{e.row}</TableCell>
                <TableCell>
                  <List sx={{ listStyleType: "disc" }}>
                    {Object.values(e.errors)
                      .filter(v => v)
                      .map((v, i) => (
                        <ListItem
                          key={i}
                          sx={{ display: "list-item", padding: 0 }}
                        >
                          {v}
                        </ListItem>
                      ))}
                  </List>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Ok</Button>
      </DialogActions>
    </Dialog>
  )
}
