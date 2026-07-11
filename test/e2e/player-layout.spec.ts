import { expect, test } from "@playwright/test"

test("player appears when playback starts and track list is pushed below it", async ({
  page,
}) => {
  await page.goto("/?e2e=1")

  await expect(page.getByTestId("player")).toBeHidden()
  await expect(page.getByTestId("track-list")).toBeVisible()
  await expect(page.getByTestId("track-item")).toHaveCount(2)

  await page.getByTestId("start-playback").click()

  const player = page.getByTestId("player")
  const firstTrack = page.getByTestId("track-item").first()

  await expect(player).toBeVisible()
  await expect(page.getByTestId("player-spacer")).toBeVisible()
  await expect(firstTrack).toBeVisible()

  const playerBox = await player.boundingBox()
  const trackBox = await firstTrack.boundingBox()

  expect(playerBox).not.toBeNull()
  expect(trackBox).not.toBeNull()

  if (!playerBox || !trackBox) {
    return
  }

  // Ensure the first library row starts below the player card.
  expect(trackBox.y).toBeGreaterThanOrEqual(playerBox.y + playerBox.height)
})

test("switching tracks does not flash a speculative player title", async ({
  page,
}) => {
  await page.goto("/?e2e=1")

  await page.getByTestId("start-playback").click()

  await expect(page.getByTestId("player")).toBeVisible()
  await expect(page.getByTestId("player-title")).toHaveText("Track One")

  await page.getByTestId("switch-to-track-2").click()

  // During switch, player should keep canonical title until commit completes.
  await expect(page.getByTestId("player-switching")).toBeVisible()
  await expect(page.getByTestId("player-title")).toHaveText("Track One")

  await expect(page.getByTestId("player-switching")).toBeHidden()
  await expect(page.getByTestId("player-title")).toHaveText("Track Two")
})