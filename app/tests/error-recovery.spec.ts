import { expect, test } from '@playwright/test'
import { loginAs, noteCard, waitForSheetToClose } from './utils/playwright-helpers'

test.describe('Error recovery', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('surfaces error banner on create failure and succeeds after retry', async ({ page }) => {
    let attempts = 0

    await page.route('**/api/users/**/notes', async (route) => {
      if (route.request().method() === 'POST') {
        attempts += 1
        if (attempts === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Simulated outage' }),
          })
          return
        }
      }
      await route.continue()
    })

    await loginAs(page, 'Error Handler')

    await page.getByRole('button', { name: 'Create note' }).click()

    const banner = page.locator('.error-banner')
    await expect(banner).toContainText('Simulated outage')

    await banner.getByRole('button', { name: 'Retry' }).click()

    await expect(banner).toHaveCount(0)

    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    await expect(noteCard(page, 'Untitled').first()).toBeVisible()

    await page.unroute('**/api/users/**/notes')
  })
})
