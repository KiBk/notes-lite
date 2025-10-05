import { expect, test } from '@playwright/test'

const loginButton = () => 'button:has-text("Enter Notes")'

test.describe('Authentication flow', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('visitor can login, session persists across reload, and sign out returns to login', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator(loginButton())).toBeVisible()

    await page.fill('input[placeholder="Pat"]', 'Morgan')
    await page.click(loginButton())

    await expect(page.locator('.top-bar')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.locator(loginButton())).toBeVisible()
  })
})
