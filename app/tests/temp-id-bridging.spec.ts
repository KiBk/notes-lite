import { expect, test } from '@playwright/test'
import { loginAs, noteCard } from './utils/playwright-helpers'

test.describe('Temp id bridging', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('keeps the note sheet open while replacing temp ids with server ids', async ({ page }) => {
    let release: (() => Promise<void>) | undefined
    let readyResolve: (() => void) | undefined
    const ready = new Promise<void>((resolve) => {
      readyResolve = resolve
    })

    await page.route('**/api/users/**/notes', async (route) => {
      if (route.request().method() === 'POST' && !route.request().url().includes('/notes/')) {
        if (!release) {
          const now = new Date().toISOString()
          release = async () => {
            await route.fulfill({
              status: 201,
              contentType: 'application/json',
              body: JSON.stringify({
                notes: {
                  'server-note-1': {
                    id: 'server-note-1',
                    title: '',
                    body: '',
                    color: '#fde2e4',
                    pinned: false,
                    archived: false,
                    createdAt: now,
                    updatedAt: now,
                  },
                },
                pinnedOrder: [],
                unpinnedOrder: ['server-note-1'],
                archivedOrder: [],
              }),
            })
          }
          readyResolve?.()
          return
        }
      }
      await route.continue()
    })

    await loginAs(page, 'Temp Bridge')

    await page.getByRole('button', { name: 'Create note' }).click()
    await ready
    await expect(noteCard(page, 'Untitled')).toBeVisible()

    await noteCard(page, 'Untitled').click()
    const sheet = page.locator('.note-sheet')
    await expect(sheet).toBeVisible()

    await release?.()

    await expect(sheet).toBeVisible()

    await page.unroute('**/api/users/**/notes')
  })
})
