import OBR, { Metadata } from "@owlbear-rodeo/sdk"
import { EventEmitter } from "events"
import { logEvent } from "firebase/analytics"
import { ObrError } from "./errors"
import { analytics } from "./firebase"
import { key } from "./key"
import { controlPath, stopPlayback } from "./mb"
import { updateMetadata } from "./metadataHelper"
import { removeTrackProgress, TrackProgressMap } from "./playback"
import { Track } from "./track"
import { checkTrack } from "./utils"

const libraryPath = key("library")
const progressPath = key("progress")

const eventEmitter = new EventEmitter()

let cachedLibrary: Track[] = []
let cachedProgress: TrackProgressMap = {}

let roomReady = false
let roomSyncPromise: Promise<void> | undefined

function push() {
  eventEmitter.emit(libraryPath, getLibrary())
}

function runWhenRoomReady(): Promise<void> {
  if (!OBR.isAvailable) {
    return Promise.resolve()
  }

  if (roomReady) {
    return Promise.resolve()
  }

  return new Promise(resolve => {
    OBR.onReady(() => {
      roomReady = true
      resolve()
    })
  })
}

function readMetadata(metadata: Metadata) {
  console.log("[library] readMetadata", metadata)

  const libraryData = metadata[libraryPath]

  cachedLibrary = Array.isArray(libraryData)
    ? [...(libraryData as Track[])]
    : []

  const progressData = metadata[progressPath]

  cachedProgress =
    progressData && typeof progressData === "object"
      ? { ...(progressData as TrackProgressMap) }
      : {}
}

async function refreshMetadataFromRoom() {
  if (!OBR.isAvailable) {
    return
  }

  const metadata = await OBR.room.getMetadata()
  readMetadata(metadata)
}

async function setLibrary(tracks: Track[]) {
  console.trace("[library] setLibrary", tracks)

  cachedLibrary = [...tracks]

  await runWhenRoomReady()

  console.log("[library] writing library metadata")

 await updateMetadata({
    [libraryPath]: cachedLibrary,
  })

  push()
}

async function setLibraryAndProgress(
  library: Track[],
  progressMap: TrackProgressMap,
  playbackUpdate?: Metadata,
) {
  console.trace("[library] setLibraryAndProgress", {
    library,
    progressMap,
  })

  cachedLibrary = [...library]
  cachedProgress = { ...progressMap }

  await runWhenRoomReady()

  console.log("[library] writing library + progress metadata")

  await updateMetadata({
    [libraryPath]: cachedLibrary,
    [progressPath]: cachedProgress,
    ...playbackUpdate,
  })

  push()
}

function getStoredLibrary(): Track[] {
  console.log("[library] getStoredLibrary()", cachedLibrary)
  return cachedLibrary
}

function getStoredProgress(): TrackProgressMap {
  return cachedProgress
}

function initializeRoomSync(): Promise<void> {
  if (roomSyncPromise) {
    return roomSyncPromise
  }

  roomSyncPromise = new Promise(resolve => {
    runWhenRoomReady().then(() => {
      console.log("[library] room ready, loading metadata")

      OBR.room.onMetadataChange(metadata => {
        console.trace(
          "[library] onMetadataChange",
          metadata,
        )

        readMetadata(metadata)
        push()
      })

      OBR.room.getMetadata().then(metadata => {
        console.log(
          "[library] getMetadata in room creation()",
          metadata,
        )

        readMetadata(metadata)
        push()

        resolve()
      })
    })
  })

  return roomSyncPromise
}

async function isTheTrackActivelyPlaying(trackUrl: String): Promise<boolean> {
  if (!OBR.isAvailable) {
    return false
  }

  const metadata = await OBR.room.getMetadata()
  
  const currentMessage = metadata[controlPath] as { track?: Track } | undefined

  return currentMessage?.track?.url === trackUrl
}

const roomSyncReady = initializeRoomSync()

export function addTrackToLibrary(track: Track) {
  logEvent(analytics, "add_track")

  return roomSyncReady.then(async () => {
    await mergeLibrary([track])
  })
}

export function deleteTrackFromLibrary(track: Track) {
  logEvent(analytics, "delete_track")

  return roomSyncReady.then(async () => {
    await refreshMetadataFromRoom()

    const currentLibrary = getLibrary()

    const nextLibrary = currentLibrary.filter(
      t => t.url !== track.url,
    )

    if(await isTheTrackActivelyPlaying (track.url)) {
      const nextProgress = removeTrackProgress(
      getStoredProgress(),
      track,
      )

      stopPlayback()

      await setLibraryAndProgress(
       nextLibrary,
       nextProgress,
       {
         [controlPath]: undefined,
       }
      )
    } else {
      await setLibrary(nextLibrary)
    }
  })
}

export async function mergeLibrary(tracks: Track[]) {
  console.trace("[library] mergeLibrary", tracks)

  await refreshMetadataFromRoom()

  const currentLibrary = getLibrary()

  const updatedLibrary = currentLibrary.map(track => ({
    ...track,
  }))

  const newTracks: Track[] = []
  const allTracks: Track[] = [...updatedLibrary]

  tracks.forEach(t => {
    const { fixed, validation } = checkTrack(t)

    if (validation) {
      throw new ObrError(
        "Track validation failed",
        fixed,
        validation,
      )
    }

    const existingIndex = updatedLibrary.findIndex(
      currentTrack => currentTrack.url === fixed.url,
    )

    const hasDuplicateTitle = allTracks.some(
      currentTrack =>
        currentTrack.title === fixed.title &&
        currentTrack.url !== fixed.url,
    )

    if (hasDuplicateTitle) {
      throw new ObrError(
        "Track validation failed",
        fixed,
        {
          titleValidation: "Title already exists",
        },
      )
    }

    if (existingIndex >= 0) {
      updatedLibrary[existingIndex] = {
        ...updatedLibrary[existingIndex],
        title: fixed.title,
        tags: fixed.tags,
      }
    } else {
      newTracks.push(fixed)
      allTracks.push(fixed)
    }
  })

  await setLibrary([
    ...newTracks,
    ...updatedLibrary,
  ])
}

export function getLibrary(): Track[] {
  return getStoredLibrary()
}

export function clearLibrary() {
  console.trace("[library] clearLibrary")

  logEvent(analytics, "clear_tracks")

  return roomSyncReady.then(async () => {
    await refreshMetadataFromRoom()
    stopPlayback()

    await setLibraryAndProgress(
      [],
      {},
      {
        [controlPath]: undefined,
      },
    )
  })
}

export function onLibraryChange(
  callback: (tracks: Track[]) => void,
): () => void {
  roomSyncReady.then(() => {
    callback(getLibrary())
  })

  eventEmitter.addListener(
    libraryPath,
    callback,
  )

  return () =>
    eventEmitter.removeListener(
      libraryPath,
      callback,
    )
}

export function cleanLibrary() {
  console.trace("[library] cleanLibrary")

  return roomSyncReady.then(async () => {
    await refreshMetadataFromRoom()

    await setLibrary(
      getLibrary().map(track => {
        const { fixed, validation } = checkTrack(track)

        if (validation) {
          console.warn(
            "Bad track in library, you should probably delete it",
            fixed,
            validation,
          )
        }

        return fixed
      }),
    )
  })
}
