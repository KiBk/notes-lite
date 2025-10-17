import { expect, test } from '@playwright/test'

import { loginAs, noteCard, waitForSheetToClose } from './utils/playwright-helpers'

test.describe('Theme switching', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('toggles theme and remaps note colors', async ({ page }) => {
    await loginAs(page, 'Theme Toggle User')

    const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme)
    expect(initialTheme).toBe('light')

    await page.getByRole('button', { name: 'Create note' }).click()
    await page.fill('input.sheet-title', 'Theme sample')
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    const sampleNote = noteCard(page, 'Theme sample').first()
    await expect(sampleNote).toBeVisible()

    const readCardColor = async () =>
      sampleNote.evaluate((element) => getComputedStyle(element).getPropertyValue('--card-color').trim())

    await expect.poll(async () => (await readCardColor()).toLowerCase()).toBe('#fde2e4')

    await page.getByRole('button', { name: 'Toggle theme' }).click()

    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')

    const colorScheme = await page.evaluate(() => document.documentElement.style.colorScheme)
    expect(colorScheme).toBe('dark')

    await expect.poll(async () => (await readCardColor()).toLowerCase()).toBe('#5b3a3f')

    await page.getByRole('button', { name: 'Toggle theme' }).click()

    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
    await expect.poll(async () => (await readCardColor()).toLowerCase()).toBe('#fde2e4')
    await expect.poll(async () => page.evaluate(() => document.documentElement.style.colorScheme)).toBe('light')
  })

  test('persists theme and remembered user across reload and sign out', async ({ page }) => {
    await loginAs(page, 'Pat Theme')

    await page.getByRole('button', { name: 'Toggle theme' }).click()
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')

    await page.reload()
    const loginButton = page.getByRole('button', { name: 'Enter Notes' })
    if ((await loginButton.count()) > 0) {
      await expect(page.getByPlaceholder('Pat')).toHaveValue('Pat Theme')
      await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
      await loginButton.click()
      await page.waitForSelector('.top-bar .user-name')
    }

    await expect(page.locator('.top-bar .user-name')).toHaveText('Pat Theme')
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')

    await page.getByRole('button', { name: 'Sign out' }).click()
    const loginInput = page.getByPlaceholder('Pat')
    await expect(loginInput).toHaveValue('Pat Theme')
    await expect.poll(async () => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
  })
})
