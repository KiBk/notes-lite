import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const waitForSheetToClose = async (page: Page) => {
  await expect(page.locator('.note-sheet')).toHaveCount(0, { timeout: 10_000 })
}

test('admin can create, pin, and archive notes', async ({ page }) => {
  await page.goto('/')

  await page.getByPlaceholder('Pat').fill('admin')
  await page.getByRole('button', { name: 'Enter Notes' }).click()

  await expect(page.locator('.top-bar .brand', { hasText: 'Notes Lite' })).toBeVisible()

  // Create first note
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page.locator('.note-sheet')).toBeVisible()
  await page.getByPlaceholder('Title').fill('Product ideas')
  await page.getByPlaceholder('Write something memorable…').fill(
    'Sketch onboarding flow, review palette options, prep launch tasks.',
  )
  await page.keyboard.press('Escape')
  await waitForSheetToClose(page)

  // Create second note
  await page.getByRole('button', { name: 'Create note' }).click()
  await expect(page.locator('.note-sheet')).toBeVisible()
  await page.getByPlaceholder('Title').fill('Release checklist')
  await page.getByPlaceholder('Write something memorable…').fill(
    'QA smoke test, verify drag-reorder, capture final screenshots.',
  )
  await page.getByRole('button', { name: '○ Colour' }).click()
  await page.locator('.color-palette .swatch').nth(3).click()
  await page.keyboard.press('Escape')
  await waitForSheetToClose(page)

  const firstCard = page.getByRole('article', { name: /Product ideas/ })
  await firstCard.hover()
  await firstCard.locator('button[aria-label="Pin note"]').click()

  const secondCard = page.getByRole('article', { name: /Release checklist/ })
  await secondCard.click()
  await expect(page.locator('.note-sheet')).toBeVisible()
  await page.getByRole('button', { name: '○ Archive' }).click()
  await page.keyboard.press('Escape')
  await waitForSheetToClose(page)

  await expect(page.getByText('Pinned', { exact: true })).toBeVisible()
  await expect(page.getByText('Notes', { exact: true })).toBeVisible()

  await page.getByRole('tab', { name: 'Archived' }).click()
  await expect(page.getByText('Archived', { exact: true })).toBeVisible()
  await expect(page.getByText('Release checklist')).toBeVisible()
})
