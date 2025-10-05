import { expect, test } from '@playwright/test'

import { createNoteThroughFab, loginAs, noteCard, waitForSheetToClose } from './utils/playwright-helpers'

test.describe('Note CRUD', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('create, edit, reopen, and permanently delete a note', async ({ page }) => {
    await loginAs(page, 'Jordan')

    await createNoteThroughFab(page, 'Meetings', 'Discuss roadmap and blockers')

    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    await expect(noteCard(page, 'Meetings')).toBeVisible()
    await noteCard(page, 'Meetings').click()
    await expect(page.locator('input.sheet-title')).toHaveValue('Meetings')
    await expect(page.locator('textarea')).toHaveValue('Discuss roadmap and blockers')

    await page.getByRole('button', { name: '○ Archive' }).click()
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    await page.getByRole('tab', { name: 'Archived' }).click()
    await expect(noteCard(page, 'Meetings')).toBeVisible()
    await noteCard(page, 'Meetings').click()

    await page.getByRole('button', { name: '○ Delete forever' }).click()

    await expect(page.locator('.note-sheet')).toHaveCount(0)
    await expect(page.getByText('Archived notes will rest here.')).toBeVisible()
  })
})
