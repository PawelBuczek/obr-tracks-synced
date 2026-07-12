import OBR, { Metadata } from "@owlbear-rodeo/sdk"
import { EventEmitter } from "events"
import { Track } from "../domain/track"
import { checkTrack } from "../shared/utils"
import { stopPlayback } from "./mb"
import {
  extractLibrary,
  extractLibraryOrderMap,
  extractLibrarySortMode,
  libraryPath,
  librarySortModePath,
  LibrarySortMode,
  sortLibraryByOrder,
} from "./metadataSchema"
import {
  clearRoomLibrary,
  deleteTrackFromRoomLibrary,
  mergeTracksIntoRoomLibrary,
  moveTrackInRoomLibrary,
  writeLibrarySortMode,
  writeLibrary,
} from "./stateOperations"

const eventEmitter = new EventEmitter()

let cachedLibrary: Track[] = []
let cachedSortMode: LibrarySortMode = LibrarySortMode.NotSorted

let roomReady = false
let roomSyncPromise: Promise<void> | undefined

function push() {
  eventEmitter.emit(libraryPath, getLibrary())
}

function pushSortMode() {
  eventEmitter.emit(librarySortModePath, getLibrarySortMode())
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
  const library = extractLibrary(metadata)
  const orderMap = extractLibraryOrderMap(metadata)
  cachedSortMode = extractLibrarySortMode(metadata)
  cachedLibrary = sortLibraryByOrder(library, orderMap)
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

  cachedLibrary = [...tracks]

  await runWhenRoomReady()

  await writeLibrary(cachedLibrary)

  push()
}

function getStoredLibrary(): Track[] {
  return cachedLibrary
}

function initializeRoomSync(): Promise<void> {
  if (roomSyncPromise) {
    return roomSyncPromise
  }

  roomSyncPromise = new Promise(resolve => {
    runWhenRoomReady().then(() => {
      OBR.room.onMetadataChange(metadata => {

        readMetadata(metadata)
        push()
        pushSortMode()
      })

      OBR.room.getMetadata().then(metadata => {
        readMetadata(metadata)
        push()
        pushSortMode()

        resolve()
      })
    })
  })

  return roomSyncPromise
}

const roomSyncReady = initializeRoomSync()

export function addTrackToLibrary(track: Track) {

  return roomSyncReady.then(async () => {
    await mergeLibrary([track])
  })
}

export function deleteTrackFromLibrary(track: Track) {

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

export function getLibrarySortMode(): LibrarySortMode {
  return cachedSortMode
}

export function clearLibrary() {
  console.trace("[library] clearLibrary")

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

export function moveTrackUpInLibrary(track: Track) {
  return roomSyncReady.then(async () => {
    const outcome = await moveTrackInRoomLibrary(track, "up")
    updateCacheFromOperationResult(outcome.library)

    if (outcome.changed) {
      push()
    }
  })
}

export function moveTrackDownInLibrary(track: Track) {
  return roomSyncReady.then(async () => {
    const outcome = await moveTrackInRoomLibrary(track, "down")
    updateCacheFromOperationResult(outcome.library)

    if (outcome.changed) {
      push()
    }
  })
}

export function setLibrarySortMode(mode: LibrarySortMode) {
  return roomSyncReady.then(async () => {
    const changed = await writeLibrarySortMode(mode)

    if (!changed) {
      return
    }

    cachedSortMode = mode
    pushSortMode()
  })
}

export function onLibrarySortModeChange(
  callback: (mode: LibrarySortMode) => void,
): () => void {
  roomSyncReady.then(() => {
    callback(getLibrarySortMode())
  })

  eventEmitter.addListener(librarySortModePath, callback)

  return () => eventEmitter.removeListener(librarySortModePath, callback)
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
