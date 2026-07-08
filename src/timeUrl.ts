export function getTimeSyncUrl(baseUrl = window.location.href): string {
  try {
    const parsed = new URL(baseUrl)
    const pathname = parsed.pathname.replace(/\/+$/, "")

    if (pathname === "" || pathname === "/") {
      return `${parsed.origin}/`
    }

    return `${parsed.origin}${pathname}/`
  } catch {
    return baseUrl
  }
}
