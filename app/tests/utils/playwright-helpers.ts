import type { Page } from '@playwright/test'

export const waitForSheetToClose = async (page: Page) => {
  await page.waitForSelector('.note-sheet', { state: 'detached' })
}

export const loginAs = async (page: Page, name: string) => {
  await page.goto('/')
  await page.waitForSelector('input[placeholder="Pat"]')
  await page.fill('input[placeholder="Pat"]', name)
  await page.click('button:has-text("Enter Notes")')
  await page.waitForSelector('.top-bar')
}

export const createNoteThroughFab = async (page: Page, title: string, body: string) => {
  await page.getByRole('button', { name: 'Create note' }).click()
  await page.fill('input.sheet-title', title)
  await page.fill('textarea', body)
}

// NOTE: DnD clones note cards during drags, so we always scope to the first match.
export const noteCard = (page: Page, title: string) =>
  page.locator('.note-card', { hasText: title }).first()
