import OBR, { Metadata } from "@owlbear-rodeo/sdk"
import { EventEmitter } from "events"
import { logEvent } from "firebase/analytics"
import { ObrError } from "./errors"
import { analytics } from "./firebase"
import { key } from "./key"
import { stop } from "./mb"
import { removeTrackProgress, TrackProgressMap } from "./playback"
import { Track } from "./track"
import { checkTrack } from "./utils"

const libraryPath = key("library")
const progressPath = key("progress")
const eventEmitter = new EventEmitter()
let cachedLibrary: Track[] = []
let cachedProgress: TrackProgressMap = {}
let roomReady = false
let roomInitialized = false

function push() {
  eventEmitter.emit(libraryPath, getLibrary())
}

function runWhenRoomReady(callback: () => void) {
  if (!OBR.isAvailable) {
    return
  }

  if (roomReady) {
    callback()
    return
  }

  OBR.onReady(() => {
    roomReady = true
    callback()
  })
}

function readMetadata(metadata: Metadata) {
  const libraryData = metadata[libraryPath]
  cachedLibrary = Array.isArray(libraryData) ? (libraryData as Track[]) : []

  const progressData = metadata[progressPath]
  cachedProgress =
    progressData && typeof progressData === "object"
      ? (progressData as TrackProgressMap)
      : {}
}

function setLibrary(tracks: Track[]) {
  cachedLibrary = tracks
  runWhenRoomReady(() => {
    OBR.room.setMetadata({ [libraryPath]: tracks })
  })
  push()
}

function setLibraryAndProgress(library: Track[], progressMap: TrackProgressMap) {
  cachedLibrary = library
  cachedProgress = progressMap
  runWhenRoomReady(() => {
    OBR.room.setMetadata({ [libraryPath]: library, [progressPath]: progressMap })
  })
  push()
}

function getStoredLibrary(): Track[] {
  return cachedLibrary
}

function getStoredProgress(): TrackProgressMap {
  return cachedProgress
}

function initializeRoomSync() {
  if (roomInitialized) {
    return
  }

  roomInitialized = true
  runWhenRoomReady(() => {
    OBR.room.getMetadata().then(metadata => {
      readMetadata(metadata)
      push()
    })

    OBR.room.onMetadataChange(metadata => {
      readMetadata(metadata)
      push()
    })
  })
}

initializeRoomSync()

export function addTrackToLibrary(track: Track) {
  logEvent(analytics, "add_track")
  mergeLibrary([track])
}

export function deleteTrackFromLibrary(track: Track) {
  logEvent(analytics, "delete_track")
  const currentLibrary = getLibrary()
  const nextLibrary = currentLibrary.filter(t => t.url !== track.url)
  const nextProgress = removeTrackProgress(getStoredProgress(), track)

  stop()
  setLibraryAndProgress(nextLibrary, nextProgress)
}

export function mergeLibrary(tracks: Track[]) {
  const currentLibrary = getLibrary()
  const newTracks: Track[] = []
  tracks.forEach(t => {
    let updated = false
    currentLibrary.forEach(currentTrack => {
      const { fixed, validation } = checkTrack(t)
      if (validation) {
        throw new ObrError("Track validation failed", fixed, validation)
      }

      if (currentTrack.url === fixed.url) {
        currentTrack.title = fixed.title
        currentTrack.tags = fixed.tags
        updated = true
      }
    })

    if (!updated) {
      newTracks.push(t)
    }
  })
  setLibrary([...newTracks, ...currentLibrary])
}

export function getLibrary(): Track[] {
  return getStoredLibrary()
}

export function clearLibrary() {
  logEvent(analytics, "clear_tracks")
  setLibraryAndProgress([], {})
}

export function onLibraryChange(
  callback: (tracks: Track[]) => void,
): () => void {
  callback(getLibrary())
  eventEmitter.addListener(libraryPath, callback)
  return () => eventEmitter.removeListener(libraryPath, callback)
}

// clean the library
export function cleanLibrary() {
  setLibrary(
    getLibrary().map(t => {
      const { fixed, validation } = checkTrack(t)
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
}
