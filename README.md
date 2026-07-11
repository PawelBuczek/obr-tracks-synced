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

Automated tests are split into tiers:

- Unit (fast, run often): `npm run test:unit`
- Integration (still fast, cross-module): `npm run test:integration`
- Simulation (slow/flaky, run on demand): `npm run test:simulation`
- Full local suite: `npm run test:all`

Default `npm test` runs unit tests.
Manual Owlbear Rodeo testing is still recommended before deployment.

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

## Deployment

This project is configured to deploy the static build to GitHub Pages via GitHub Actions.

## Contribute

Sure! But reach out to me on [discord](https://discord.gg/u5RYMkV98s) if you are thinking about large changes.
