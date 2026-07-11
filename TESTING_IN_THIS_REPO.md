# Testing In This Repo

This repository uses Vitest for unit/integration/simulation tests and Playwright for browser E2E checks.

## First-Time Setup

Run these once after downloading/cloning the repo:

```bash
npm install
npx playwright install chromium
```

Notes:
- `npm install` installs all test tooling.
- `npx playwright install chromium` downloads the browser binary used by E2E tests.

## Test Commands

- `npm test`
  - Alias for `npm run test:unit`
- `npm run test:unit`
  - Fast unit/UI component tests (`src/vitests/unit`)
- `npm run test:integration`
  - Cross-module integration tests (`src/vitests/integration`)
- `npm run test:simulation`
  - On-demand simulation tests (`src/vitests/simulation`)
- `npm run test:e2e`
  - Playwright browser tests (`test/e2e`)
- `npm run test:all`
  - Unit + integration + simulation (does not include E2E)

## Useful Targeted Runs

```bash
npm run test:unit -- TrackProgress
npm run test:unit -- App.playerVisibility
npm run test:e2e -- player-layout
```

## Current Test Structure

- Unit/UI: `src/vitests/unit`
- Integration: `src/vitests/integration`
- Simulation: `src/vitests/simulation`
- E2E: `test/e2e`

## Practical Recommendation

Before deployment, run at least:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e -- player-layout
```

Manual Owlbear Rodeo verification is still recommended before release.
