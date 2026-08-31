import OBR from "@owlbear-rodeo/sdk"

// The SDK's notification.show() has no built-in auto-dismiss, so we close it ourselves.
const DEFAULT_DISMISS_MS = 100_000

export type NotificationVariant = "DEFAULT" | "ERROR" | "INFO" | "SUCCESS" | "WARNING"

export function showNotification(
  message: string,
  variant: NotificationVariant,
  dismissAfterMs: number = DEFAULT_DISMISS_MS,
) {
  void Promise.resolve(OBR.notification.show(message, variant)).then(id => {
    setTimeout(() => {
      void OBR.notification.close(id)
    }, dismissAfterMs)
  })
}
