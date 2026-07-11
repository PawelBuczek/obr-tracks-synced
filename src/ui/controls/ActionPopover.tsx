import { useTheme } from "@mui/material"
import OBR from "@owlbear-rodeo/sdk"
import { ReactNode, useEffect } from "react"

interface Props {
  children?: ReactNode
  height?: number
  badgeText?: string
  badgeColor?: string
}

export function ActionPopover(props: Props) {
  const { children, height, badgeText, badgeColor } = props
  const theme = useTheme()

  useEffect(() => {
    if (height) {
      OBR.action.setHeight(height)
    }
  }, [height])

  useEffect(() => {
    OBR.action.setBadgeText(badgeText)
  }, [badgeText])

  useEffect(() => {
    OBR.action.setBadgeBackgroundColor(
      badgeColor ?? theme.palette.secondary.main,
    )
  }, [badgeColor])

  return children
}
