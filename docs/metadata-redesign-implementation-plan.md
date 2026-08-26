# Metadata Redesign Implementation Plan

Status: **implementation plan**

This plan implements the decisions in [metadata-redesign-explanation.md](metadata-redesign-explanation.md):

- Track tags are numeric IDs.
- Built-in tags are static application data and are never stored in room metadata.
- Custom tags occupy IDs `85..99` and are stored in `com.obr.tracks/customTags`.
- URLs are canonicalized at every boundary and canonical URLs are the identity keys.
- Library array position is the only shared ordering metadata.
- Sort mode is local to each viewer.
- Track rows carry their resting `offset`; the standalone `progress` key is removed.
- `control.track` has no `offset` field.
- Deleting a custom tag also removes that ID from all library rows in the same metadata transform.
- No backwards compatibility with the old room format is required.

## Invariants to preserve

1. Every persisted track has a non-empty canonical URL, title, valid numeric tag IDs, and a finite non-negative offset.
2. Track identity uses canonical URL equality everywhere. Dropbox share/direct URL variants must canonicalize to the same URL.
3. Track updates preserve the existing row's offset unless the operation explicitly changes it.
4. A playback write cannot resurrect a deleted or cleared track.
5. Library mutations resolve from one current metadata snapshot through the existing write queue.
6. Custom-tag create, rename, and delete are atomic with respect to the metadata they affect.
7. Built-in tag array positions are stable protocol IDs. Reordering or reusing an existing built-in ID is forbidden.
8. The library payload remains capped at 6 KB when adding tracks.

## Chunk 0: Lock the baseline and fixtures

**Purpose:** establish a known starting point before changing the schema.

- Run `npm run test:all` and `npm run build`.
- Record the current result in the implementation PR/working notes, not in room metadata.
- Add representative fixture helpers for ordinary URLs, Dropbox URL variants, tracks with tags, and tracks with non-zero offsets.
- Add a small metadata-size measurement helper/test fixture so the post-redesign size can be compared against realistic libraries.

**Tests to run:**

```text
npm run test:all
npm run build
```

## Chunk 1: Canonical URL identity

**Files/surfaces:** `src/domain/track.ts`, `src/shared/utils.ts`, room schema and mutation policy callers, CSV import, UI track creation paths.

- Add one exported `canonicalizeTrackUrl` function at the domain boundary.
- Move the current Dropbox normalization into that function and define behavior for ordinary URLs, query parameters, fragments, whitespace, invalid URLs, and already-canonical URLs.
- Make `checkTrack`/`cleanTrack` return canonical URLs.
- Ensure `isSameTrack` compares canonical URLs rather than independently reimplementing normalization.
- Canonicalize URLs when parsing metadata, importing CSV, creating/updating tracks, selecting playback, and resolving control messages.
- Decide whether fragments and non-Dropbox query parameters are identity-significant; encode that decision in tests.

**Tests to add/update:**

- Canonicalization is idempotent.
- Dropbox share and direct URLs compare equal and persist in one canonical form.
- Add/update/delete/move operations find the same track through URL variants.
- CSV import produces canonical URLs.
- Existing URL validation behavior remains intact.

**Tests to run:**

```text
npx vitest run src/vitests/unit/utils.test.ts src/vitests/unit/playback.test.ts src/vitests/integration/conflictInvariants.test.ts
npm run build
```

## Chunk 2: New track and metadata schema

**Files/surfaces:** `src/domain/track.ts`, `src/room/metadataSchema.ts`, `src/domain/playback.ts`, schema tests, all track fixtures.

- Change `Track.tags` from `string[]` to `number[]`.
- Add `Track.offset: number` and make `emptyTrack`, validation, parsers, and fixtures provide `0`.
- Add strict constants and validators for tag IDs, maximum tags per track, and offsets.
- Add `customTagsPath` and `CustomTagMap` extraction/validation.
- Parse `control.track` using the new track representation but omit `offset` from the returned control track. Keep control playback `offset` unchanged.
- Remove old progress and order extractors only after their callers have migrated; temporarily keep compile errors visible as the migration checklist.
- Do not add a metadata version unless implementation reveals a need for distinguishing malformed data; no legacy compatibility is required.

**Tests to add/update:**

- Valid and invalid numeric tag IDs.
- Maximum tag count and duplicate-ID policy.
- Missing offset defaults to `0` only for local/input normalization; persisted malformed rows are rejected or normalized consistently.
- Invalid custom-tag map keys/values are ignored or rejected according to one documented policy.
- `control.track` contains no offset while `control.offset` still parses correctly.
- Malformed metadata does not crash the room reader.

**Tests to run:**

```text
npx vitest run src/vitests/unit/metadataSchema.test.ts src/vitests/unit/playback.test.ts
npm run build
```

## Chunk 3: Static built-in tags and numeric tag resolution

**Files/surfaces:** new `src/domain/tags.ts`, `src/shared/utils.ts`, `src/io/csv.ts`, library dialog/search/list components, metadata schema tests.

- Add the final 85 built-in tag list as an append-only, index-stable constant.
- Add helpers to resolve an ID to a display name and to resolve a normalized name to an ID.
- Define unknown/deleted custom-tag behavior: unknown IDs are ignored in display and do not crash parsing/rendering.
- Update validation to reject names that do not resolve to a built-in or existing custom tag when operating on room data.
- Keep CSV human-readable: import names into IDs using built-ins plus the room custom-tag map; export IDs back to names. Define how CSV import handles a custom tag absent from the room.
- Update UI state and props so room metadata uses IDs while controls can still display names.
- Ensure built-in names are not written to `customTags`.

**Tests to add/update:**

- Every built-in name has a stable ID and round-trips name -> ID -> name.
- Case-insensitive trimmed duplicate checks against built-ins and custom tags.
- Unknown custom IDs are filtered from display.
- CSV round-trip preserves tag names and produces numeric room tags.
- Track validation enforces at most five valid IDs.

**Tests to run:**

```text
npx vitest run src/vitests/unit/metadataSchema.test.ts src/vitests/unit/csv.test.ts src/vitests/unit/utils.test.ts
npm run test:all
```

## Chunk 4: Remove shared order metadata

**Files/surfaces:** `src/room/state/libraryMutationPolicy.ts`, `src/room/state/libraryMutations.ts`, `src/room/metadataSchema.ts`, `src/ui/library/TrackList.tsx`, ordering tests.

- Delete `libraryOrderPath`, `LibraryOrderMap`, and `sortLibraryByOrder`.
- Treat the extracted library array as authoritative order.
- Make merge preserve the existing array position for same-identity updates and append new tracks.
- Make move operations swap array elements directly.
- Ensure delete and clear write only the library array, while preserving the existing playback-stop behavior.
- Remove any stale order metadata explicitly only where the new clean schema requires it; do not build compatibility logic.

**Tests to add/update:**

- Add preserves existing order when merging updates.
- Concurrent/interleaved add, rename, delete, clear, and move operations preserve the documented ordering policy.
- Moving first/last/missing tracks is a no-op.
- No mutation writes `libraryOrder`.

**Tests to run:**

```text
npx vitest run src/vitests/integration/library.test.ts src/vitests/integration/conflictOrdering.test.ts src/vitests/integration/conflictInvariants.test.ts
npm run build
```

## Chunk 5: Move progress offsets onto library rows

**Files/surfaces:** `src/domain/playback.ts`, `src/room/state/playbackWrites.ts`, `src/room/state/libraryWrites.ts`, `src/room/state/libraryMutationPolicy.ts`, `src/room/state/libraryMutations.ts`, `src/room/mb.ts`, player/provider code, playback and state tests.

- Remove `TrackProgressMap`, `progressPath`, and progress helper APIs once callers are migrated.
- Add a snapshot transform that updates exactly one canonical library row's `offset`.
- Save the outgoing track's resting offset on pause or track switch; reset it to `0` on full stop and on add.
- When updating title/tags, preserve the current row offset. When replacing a track by logical identity, retain the canonical URL and existing offset unless explicitly reset.
- Update optimistic selection to read the target row's offset.
- Keep active playback timing in `control.offset`; `control.track` carries title, URL, and numeric tags only.
- Keep stale control-ID checks and the absent-track guard. Folding progress into rows does not eliminate the need for stale control protection.
- On delete/clear, removing the row removes its offset automatically; deleting the active track still clears control and stops local playback.
- Review all writes for accidental full-library replacement based on stale local arrays. Library-affecting writes must use the current-snapshot transform.

**Tests to add/update:**

- Title/tag update preserves a non-zero row offset.
- Pause, resume, switch-away, and stop write/read the expected row offset.
- Add initializes offset to `0`.
- Delete and clear remove offsets with the rows.
- A stale offset write after delete/clear is a no-op and cannot recreate a row.
- Dropbox URL variants update the same row.
- Stale control IDs remain no-ops.
- `control.track.offset` is absent from serialized control metadata.
- Playback ticks do not modify unrelated rows.

**Tests to run:**

```text
npx vitest run src/vitests/unit/playback.test.ts src/vitests/unit/MessageProvider.optimisticPlayOffset.test.tsx src/vitests/unit/metadataSchema.test.ts src/vitests/integration/conflictInvariants.test.ts src/vitests/integration/statesynch.test.ts
npm run test:all
npm run build
```

## Chunk 6: Make sort mode local-only

**Files/surfaces:** `src/ui/app/App.tsx`, `src/ui/library/TrackSearch.tsx`, `src/ui/library/TrackList.tsx`, `src/room/state/libraryWrites.ts`, local-storage helpers, UI tests.

- Remove `librarySortModePath`, its metadata extractor, and room write function.
- Add a small local-storage read/write helper with a safe default of `not_sorted`.
- Keep sorting as a viewer-side projection; never reorder or rewrite the shared library merely to display alphabetically.
- Preserve the existing UI behavior that disables manual reorder controls while alphabetical display mode is active.
- Handle invalid or unavailable local storage by falling back to `not_sorted`.

**Tests to add/update:**

- Sort mode is restored for the same browser and absent from room metadata writes.
- Different local viewers can use different sort modes without changing shared array order.
- Invalid local-storage values use the default.
- Manual reorder remains disabled only in the local alphabetical view.

**Tests to run:**

```text
npx vitest run src/vitests/unit/App.playerVisibility.test.tsx src/vitests/integration/library.test.ts
npm run test:all
```

## Chunk 7: Custom tag lifecycle and atomic usage cleanup

**Files/surfaces:** new custom-tag state module, `src/room/metadataSchema.ts`, `src/room/state/libraryMutationPolicy.ts`, `src/room/state/libraryMutations.ts`, library UI/dialog, role/permission code, integration tests.

- Add create, rename, and delete operations using `updateMetadataWithCurrent`.
- Create chooses the lowest unused ID in `85..99`; reject when all slots are occupied.
- Normalize names with trim and case-insensitive duplicate checks against built-ins and custom tags.
- Enforce the 15-character limit.
- Rename updates only `customTags` and leaves numeric track IDs unchanged.
- Delete removes the custom-tag entry and strips that ID from every library row in the same current-snapshot transform. This is intentionally an atomic library plus custom-tags update.
- Decide and implement authorization consistently with the existing room role model before exposing custom-tag management in the UI.
- Decide whether deleted IDs may be reused immediately. If they are reusable, document that stale old rows are cleaned synchronously by delete; if a stale external row remains, ID reuse can change its meaning.
- Return explicit rejection reasons for duplicate, invalid length, and slot exhaustion.

**Tests to add/update:**

- Lowest-free-ID allocation and full-pool rejection.
- Duplicate checks are trimmed and case-insensitive.
- Rename keeps every referencing numeric ID valid.
- Delete strips the ID from all tracks and preserves other IDs/offsets.
- Delete is atomic: either both custom-tag removal and library cleanup are produced, or neither is.
- Interleaved create/delete/rename operations resolve from the current snapshot.
- Cross-client race tests verify no lost custom tags or resurrected deleted usages, even if the race is rare.

**Tests to run:**

```text
npx vitest run src/vitests/unit/metadataSchema.test.ts src/vitests/integration/library.test.ts src/vitests/integration/conflictInvariants.test.ts src/vitests/integration/conflictOrdering.test.ts
npm run test:all
npm run build
```

## Chunk 8: Size enforcement and final cleanup

**Files/surfaces:** library mutation size guard, metadata helper, fixtures, README/proposal documentation, all tests.

- Measure the serialized library using the same UTF-8 method as the existing 6 KB guard.
- Confirm that numeric tags plus per-row offsets fit the intended realistic library fixtures; retain the existing policy that rejects only additions over the library cap while allowing updates to existing rows if that remains intentional.
- Remove dead progress/order/sort imports, compatibility types, and old tests that assert the old schema.
- Remove debug logging from library writes if still present.
- Keep [metadata-redesign-explanation.md](metadata-redesign-explanation.md) aligned with the implemented decisions.
- Update README metadata documentation and conflict rules for row-offset writes and atomic custom-tag cleanup.
- Add a final metadata snapshot test asserting the new keys and absence of `progress`, `libraryOrder`, and `librarySortMode` after normal operations.

**Tests to run:**

```text
npm run test:all
npm run build
npm run test:e2e
```

## Definition of done

- All new and migrated tests pass.
- Build and E2E tests pass.
- Normal room writes produce only `library`, `customTags`, and `control` among the redesigned keys.
- No code path depends on raw or non-canonical track URLs for identity.
- Track offsets survive metadata edits and cannot outlive their rows.
- Custom-tag deletion cannot leave its ID in the library.
- Shared array order and per-viewer sort mode are demonstrably separate concerns.
- README and [metadata-redesign-explanation.md](metadata-redesign-explanation.md) describe the implemented conflict behavior, including the fact that the write queue serializes writes per client but cannot make cross-client races globally atomic without snapshot resolution.
