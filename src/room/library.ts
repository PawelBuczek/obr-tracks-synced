import OBR, { Metadata } from "@owlbear-rodeo/sdk"
import { EventEmitter } from "events"
import { logEvent } from "firebase/analytics"
import { Track } from "../domain/track"
import { analytics } from "../infra/firebase"
import { checkTrack } from "../shared/utils"
import { stopPlayback } from "./mb"
import {
  extractLibrary,
  libraryPath,
} from "./metadataSchema"
import {
  clearRoomLibrary,
  deleteTrackFromRoomLibrary,
  mergeTracksIntoRoomLibrary,
  writeLibrary,
} from "./stateOperations"

const eventEmitter = new EventEmitter()

let cachedLibrary: Track[] = []

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
  cachedLibrary = extractLibrary(metadata)
}

async function refreshMetadataFromRoom() {
  if (!OBR.isAvailable) {
    return
  }

  const metadata = await OBR.room.getMetadata()
  readMetadata(metadata)
}

function updateCacheFromOperationResult(library: Track[]) {
  cachedLibrary = [...library]
}

async function setLibrary(tracks: Track[]) {
  console.trace("[library] setLibrary", tracks)

  cachedLibrary = [...tracks]

  await runWhenRoomReady()

  console.log("[library] writing library metadata")

  await writeLibrary(cachedLibrary)

  push()
}

function getStoredLibrary(): Track[] {
  console.log("[library] getStoredLibrary()", cachedLibrary)
  return cachedLibrary
}

function initializeRoomSync(): Promise<void> {
  if (roomSyncPromise) {
    return roomSyncPromise
  }

  roomSyncPromise = new Promise(resolve => {
    runWhenRoomReady().then(() => {
      console.log("[library] room ready, loading metadata")

      OBR.room.onMetadataChange(metadata => {
        console.trace("[library] onMetadataChange", metadata)

        readMetadata(metadata)
        push()
      })

      OBR.room.getMetadata().then(metadata => {
        console.log("[library] getMetadata in room creation()", metadata)

        readMetadata(metadata)
        push()

        resolve()
      })
    })
  })

  return roomSyncPromise
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
    const outcome = await deleteTrackFromRoomLibrary(track)
    updateCacheFromOperationResult(outcome.library)

    if (outcome.shouldStopPlayback) {
      stopPlayback()
    }

    if (outcome.changed) {
      push()
    }
  })
}

export async function mergeLibrary(tracks: Track[]) {
  console.trace("[library] mergeLibrary", tracks)

  try {
    const outcome = await mergeTracksIntoRoomLibrary(tracks)
    updateCacheFromOperationResult(outcome.library)

    if (outcome.changed) {
      push()
    }
  } catch (error) {
    // Keep local cache consistent with room state on validation failures.
    await refreshMetadataFromRoom()
    throw error
  }
}

export function getLibrary(): Track[] {
  return getStoredLibrary()
}

export function clearLibrary() {
  console.trace("[library] clearLibrary")

  logEvent(analytics, "clear_tracks")

  return roomSyncReady.then(async () => {
    const outcome = await clearRoomLibrary()
    updateCacheFromOperationResult(outcome.library)

    if (outcome.shouldStopPlayback) {
      stopPlayback()
    }

    if (outcome.changed) {
      push()
    }
  })
}

export function onLibraryChange(
  callback: (tracks: Track[]) => void,
): () => void {
  roomSyncReady.then(() => {
    callback(getLibrary())
  })

  eventEmitter.addListener(libraryPath, callback)

  return () => eventEmitter.removeListener(libraryPath, callback)
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
