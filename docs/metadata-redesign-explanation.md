# Metadata Redesign Decisions

Status: **decided design**

This document records the final metadata decisions. The implementation sequence and test checkpoints are in [metadata-redesign-implementation-plan.md](metadata-redesign-implementation-plan.md).

## Room metadata

The redesigned room state uses these keys:

- `com.obr.tracks/library`: an ordered array of tracks.
- `com.obr.tracks/customTags`: a sparse map containing only room-defined custom tags.
- `com.obr.tracks/control`: the active playback state.

The standalone `progress`, `libraryOrder`, and `librarySortMode` metadata keys are removed. No backwards compatibility with the old format is required.

## Track schema

```ts
interface Track {
  title: string
  url: string
  tags: number[]
  offset: number
}
```

Array position is the shared library order. `offset` is the resting playback position and defaults to `0` for new or fully stopped tracks.

URLs are canonicalized at every boundary. Canonical URLs are used for persistence and identity, including Dropbox share/direct URL variants.

Track updates preserve the existing offset unless the operation explicitly changes it. Deleting a track removes its offset because the complete row is removed.

## Tags

Tags use one stable numeric ID space:

- IDs `0..84` are built-in tags shipped as a static, append-only application constant.
- IDs `85..99` are custom tags stored in `customTags`.

Built-in tag names are never stored in room metadata. A track may have at most five valid tag IDs. Custom tag names are trimmed, at most 15 characters, and cannot duplicate a built-in or custom name case-insensitively.

Custom-tag creation uses the lowest free ID. Renaming changes only the custom-tag map. Deleting a custom tag removes the ID from every library row in the same metadata transform, so no dangling usages remain. Deleted IDs may be reused after cleanup.

## Playback control

`control` remains separate from `library` so active playback updates do not require rewriting every track. Its `track` contains the active track identity and display metadata but does not contain `offset`.

Playback timing remains in `control.offset`. Resting offsets for inactive tracks live on their library rows.

Stale control IDs and writes targeting tracks absent from the current library are no-ops. All library-affecting writes resolve against one current metadata snapshot through the existing serialized write mechanism.

## Viewer preference and limits

Sort mode is a per-viewer preference stored in local storage. It never changes the shared library order.

The serialized library has a hard 6 KB cap for additions. The broader room metadata limit remains a separate concern.
