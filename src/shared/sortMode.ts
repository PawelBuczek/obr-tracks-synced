import { key } from "./key"

const path = key("librarySortMode")

export enum LibrarySortMode {
  NotSorted = "not_sorted",
  Ascending = "ascending",
  Descending = "descending",
}

function isLibrarySortMode(value: string | null): value is LibrarySortMode {
  return (
    value === LibrarySortMode.NotSorted ||
    value === LibrarySortMode.Ascending ||
    value === LibrarySortMode.Descending
  )
}

export function getSortMode(): LibrarySortMode {
  try {
    const value = localStorage.getItem(path)
    return isLibrarySortMode(value) ? value : LibrarySortMode.NotSorted
  } catch {
    return LibrarySortMode.NotSorted
  }
}

export function setSortMode(mode: LibrarySortMode): void {
  try {
    localStorage.setItem(path, mode)
  } catch {
  }
}
