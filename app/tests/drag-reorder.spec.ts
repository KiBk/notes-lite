import { expect, test } from '@playwright/test'

import { createNoteThroughFab, loginAs, noteCard, waitForSheetToClose } from './utils/playwright-helpers'

test.describe('Drag reorder', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('reorders pinned notes via drag and persists after reload', async ({ page }) => {
    await loginAs(page, 'Harper')

    await createNoteThroughFab(page, 'Alpha pinned', 'First pinned note')
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)
    await expect(noteCard(page, 'Alpha pinned')).toBeVisible()
    await noteCard(page, 'Alpha pinned').getByRole('button', { name: 'Pin note' }).click()

    await createNoteThroughFab(page, 'Beta pinned', 'Second pinned note')
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)
    await expect(noteCard(page, 'Beta pinned')).toBeVisible()
    await noteCard(page, 'Beta pinned').getByRole('button', { name: 'Pin note' }).click()

    const pinnedSection = page.locator('section.notes-section').filter({ hasText: 'Pinned' })
    await expect(pinnedSection.locator('.note-card')).toHaveCount(2)

    const alphaCard = pinnedSection.locator('.note-card').filter({ hasText: 'Alpha pinned' })
    const betaCard = pinnedSection.locator('.note-card').filter({ hasText: 'Beta pinned' })

    const alphaBox = await alphaCard.boundingBox()
    const betaBox = await betaCard.boundingBox()
    if (!alphaBox || !betaBox) {
      throw new Error('Missing bounding boxes for drag operation')
    }

    await page.mouse.move(alphaBox.x + alphaBox.width / 2, alphaBox.y + alphaBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(betaBox.x + betaBox.width / 2, betaBox.y + betaBox.height / 2, { steps: 12 })
    await page.mouse.up()

    await expect(pinnedSection.locator('.note-card').first()).toContainText('Alpha pinned')

    await page.reload()

    const reloadedPinned = page.locator('section.notes-section').filter({ hasText: 'Pinned' })
    await expect(reloadedPinned.locator('.note-card').first()).toContainText('Alpha pinned')
  })
})
