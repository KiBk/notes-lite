import { expect, test } from '@playwright/test'

import { loginAs, noteCard } from './utils/playwright-helpers'

test.describe('Theme switching', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('toggles theme and remaps note colors', async ({ page }) => {
    await loginAs(page, 'admin user')

    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme)
    expect(initialTheme).toBe('light')

    const pinnedNote = noteCard(page, 'Team sync notes')
    await expect(pinnedNote).toBeVisible()
    const initialColor = await pinnedNote.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--card-color'),
    )

    await page.getByRole('button', { name: 'Toggle theme' }).click()

    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')

    const remappedColor = await pinnedNote.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--card-color'),
    )
    expect(remappedColor).not.toBe(initialColor)
  })
})
