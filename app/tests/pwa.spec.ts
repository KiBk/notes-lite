import { expect, test } from '@playwright/test'

test.describe('PWA essentials', () => {
  test('exposes manifest, registers service worker, and loads offline', async ({ page, context }) => {
    await page.goto('/')

    const manifest = page.locator('link[rel="manifest"]')
    await expect(manifest).toHaveAttribute('href', '/manifest.webmanifest')

    const swReady = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return false
      }
      const registration = await navigator.serviceWorker.ready
      return Boolean(registration.active)
    })

    expect(swReady).toBeTruthy()

    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Enter Notes' })).toBeVisible()
    await context.setOffline(false)
  })
})
