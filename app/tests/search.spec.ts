import { expect, test } from '@playwright/test'

import { loginAs, noteCard } from './utils/playwright-helpers'

test.describe('Search behaviour', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('filters across active and archived buckets and shows empty state when no matches', async ({ page }) => {
    await loginAs(page, 'admin user')

    const search = page.getByPlaceholder('Search notes')

    await search.fill('launch')
    await expect(page.getByText('Archived matches')).toBeVisible()
    await expect(noteCard(page, 'Launch recap')).toBeVisible()
    await expect(page.getByText('Showing matches across notes and archive.')).toBeVisible()

    await search.fill('zzz')
    await expect(page.getByText('No notes match that search.')).toBeVisible()

    await search.fill('')
    await expect(page.getByText('Pinned', { exact: true })).toBeVisible()
  })
})
