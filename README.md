# TracksSynced

Play long looping background music and ambiance from your own library with builtin search and synchronized playback.

This fork is adapted for Owlbear Rodeo use and can be hosted as a static web app.

![logo](./public/tracks.png)

## Manifest URL

After deployment, the manifest will be available at:

https://<your-github-username>.github.io/<your-repo>/manifest.json

in my case: https://pawelbuczek.github.io/obr-tracks-synced/manifest.json

## More info

Check out the [store docs](docs/store.md)

## Development

You can run `npm run build` to check that the project compiles.

Testing setup, commands, and test suite overview are documented in [TESTING_IN_THIS_REPO.md](TESTING_IN_THIS_REPO.md).

## Room Metadata Notes

Room metadata is now parsed through a single schema boundary in `src/room/metadataSchema.ts`.
Metadata writes are centralized in `src/room/stateOperations.ts`.

- `com.obr.tracks/control`: current playback message
- `com.obr.tracks/progress`: per-track offset map
- `com.obr.tracks/library`: track library

The current conflict strategy is hybrid:

- queue and serialize writes per client
- route playback and library writes through centralized room operations
- run library merge/delete/clear decisions against one queued current metadata snapshot
- treat stale operations as safe no-ops when the target is already gone (for example delete-after-delete)

Conflict safety invariants are verified in `src/vitests/integration/conflictInvariants.test.ts`.

### Conflict Rules Matrix (M7)

All room writes are serialized per client and resolved against one queued current metadata snapshot.

| Operation Pair | Resolution Rule | Expected End State |
|---|---|---|
| `merge` + `merge` (same logical track) | Last writer wins for `title/tags`; track identity is normalized (`isSameTrack`) | Single track entry, latest `title/tags` |
| `play` + `play` (different tracks) | Last applied control write wins | Final control points at later-selected track |
| `merge` + `merge` (different tracks, same `title`) | Reject second write with duplicate-title validation | First valid write remains |
| `delete` + `delete` (same logical track) | First delete removes; stale second delete becomes no-op | Track absent |
| `clear` + `clear` | First clear removes all; stale second clear becomes no-op | Empty library/progress/control |
| `delete`/`clear` + playback update (`play/pause/resume/seek`) | Metadata order decides final state; later write is authoritative | Deterministic last-applied state |
| stale `pause`/`resume`/`seek` after control replacement | If expected control id no longer matches current control id, write becomes no-op | Newer playback control remains authoritative |
| stale `play` for deleted track | If target track is absent from room library, write becomes no-op | Deleted track cannot be resurrected by late play |
| `delete` of currently playing track | Always clear control and track progress when logical track matches | Playback stopped for deleted track |
| `merge` updating currently playing track details | Refresh control track `title/tags` without changing active playback id/timing | UI reflects latest metadata |

## Deployment

This project is configured to deploy the static build to GitHub Pages via GitHub Actions.

## Contribute

Sure! But reach out to me on [discord](https://discord.gg/u5RYMkV98s) if you are thinking about large changes.
