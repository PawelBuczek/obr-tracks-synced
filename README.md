# TracksPausing

Play long looping background music and ambiance from your own library with builtin search and synchronized playback.

This fork is adapted for Owlbear Rodeo use and can be hosted as a static web app.

![logo](./public/tracks.png)

## Manifest URL

After deployment, the manifest will be available at:

https://<your-github-username>.github.io/<your-repo>/manifest.json

in my case: https://pawelbuczek.github.io/obr-tracks-pausing/manifest.json

## More info

Check out the [store docs](docs/store.md)

## Development

You can run `npx vitest run` and `npm run build` to check if the project at least builds. Some tests are there, but not many.
Most of the testing just happens by deploying, adding custom extension in a room in Owlbear Rodeo and playing around.

## Deployment

This project is configured to deploy the static build to GitHub Pages via GitHub Actions.

## Contribute

Sure! But reach out to me on [discord](https://discord.gg/u5RYMkV98s) if you are thinking about large changes.
