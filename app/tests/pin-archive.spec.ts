import { expect, test } from '@playwright/test'

import { createNoteThroughFab, loginAs, noteCard, waitForSheetToClose } from './utils/playwright-helpers'

test.describe('Pin and archive flows', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('pinning/unpinning updates order and archiving moves notes between buckets', async ({ page }) => {
    const user = `Casey-${Date.now()}`
    await loginAs(page, user)

    await createNoteThroughFab(page, 'First note', 'Alpha body')
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    await createNoteThroughFab(page, 'Second note', 'Beta body')
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    const firstNoteCard = noteCard(page, 'First note')
    await expect(firstNoteCard).toBeVisible()
    await firstNoteCard.getByRole('button', { name: 'Pin note' }).click()

    const pinnedSection = page.locator('section.notes-section').filter({ hasText: 'Pinned' })
    await expect(pinnedSection.locator('.note-card').filter({ hasText: 'First note' })).toBeVisible()
    await expect(noteCard(page, 'Second note')).toBeVisible()

    await pinnedSection.getByRole('button', { name: 'Unpin note' }).click()

    const notesSection = page.locator('section.notes-section').filter({ hasText: /Notes|Matches/ })
    const activeTitles = await notesSection.locator('.note-card').evaluateAll((elements) => {
      const titles: string[] = []
      const seen = new Set<string>()
      elements.forEach((element) => {
        const title = element.querySelector('.note-title')?.textContent?.trim()
        if (!title || seen.has(title)) return
        seen.add(title)
        titles.push(title)
      })
      return titles
    })
    expect(activeTitles[0]).toBe('First note')

    // Archive the second note and verify it leaves the active grid
    const secondNote = noteCard(page, 'Second note')
    await expect(secondNote).toBeVisible()
    await secondNote.click()
    await page.getByRole('button', { name: '○ Archive' }).click()
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    await expect(notesSection.locator('.note-card', { hasText: 'Second note' })).toHaveCount(0)

    await page.getByRole('tab', { name: 'Archived' }).click()
    const archivedSection = page.locator('section.notes-section').filter({ hasText: 'Archived' })
    const archivedNote = archivedSection.locator('.note-card').filter({ hasText: 'Second note' })
    await expect(archivedNote).toBeVisible()

    await archivedNote.click()
    await page.getByRole('button', { name: '● Unarchive' }).click()
    await page.keyboard.press('Escape')
    await waitForSheetToClose(page)

    await page.getByRole('tab', { name: 'Notes' }).click()
    await expect(noteCard(page, 'Second note')).toBeVisible()
  })
})
