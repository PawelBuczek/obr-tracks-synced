export interface Track {
  title: string
  url: string
  tags: string[]
}

export function isSameTrack(left: Track, right: Track): boolean {
  try {
    const leftUrl = new URL(left.url)
    const rightUrl = new URL(right.url)

    if (leftUrl.hostname.endsWith("dropbox.com")) {
      leftUrl.searchParams.set("dl", "1")
      leftUrl.hostname = "dl.dropboxusercontent.com"
    }

    if (rightUrl.hostname.endsWith("dropbox.com")) {
      rightUrl.searchParams.set("dl", "1")
      rightUrl.hostname = "dl.dropboxusercontent.com"
    }

    return leftUrl.toString() === rightUrl.toString()
  } catch {
    return left.url === right.url
  }
}

export function toString(track: Track): string {
  return `Title: ${track.title}: Url: ${track.url}`
}

export function emptyTrack(): Track {
  String()
  return {
    title: "",
    url: "",
    tags: [],
  }
}
