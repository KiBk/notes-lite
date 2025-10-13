import { expect, test } from '@playwright/test'

import { createNoteThroughFab, loginAs, noteCard, waitForSheetToClose } from './utils/playwright-helpers'

test.describe('Search behaviour', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('filters across active and archived buckets and shows empty state when no matches', async ({ page }) => {
    await loginAs(page, 'admin user')

    await createNoteThroughFab(page, 'Launch recap', 'Post launch summary')
    await page.getByRole('button', { name: '○ Archive' }).click()
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    await createNoteThroughFab(page, 'Roadmap draft', 'Next steps')
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    const search = page.getByPlaceholder('Search notes')

    await search.fill('launch')
    await expect(page.getByText('Archived matches')).toBeVisible()
    await expect(noteCard(page, 'Launch recap')).toBeVisible()
    await expect(page.getByText('Showing matches across notes and archive.')).toBeVisible()

    await search.fill('zzz')
    await expect(page.getByText('No notes match that search.')).toBeVisible()

    await search.fill('')
    await expect(noteCard(page, 'Roadmap draft')).toBeVisible()
  })
})
