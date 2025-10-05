import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import type { AxeResults } from 'axe-core'

import { loginAs } from './utils/playwright-helpers'

const assertNoSeriousViolations = (context: string, results: AxeResults) => {
  const impactful = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  )
  expect(impactful, `${context} has accessibility issues`).toEqual([])
}

test.describe('Accessibility smoke', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
    await context.clearPermissions()
  })

  test('login and main app views are free of serious Axe violations', async ({ page }) => {
    await page.goto('/')
    const loginScan = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
    assertNoSeriousViolations('Login view', loginScan)

    await loginAs(page, 'Morgan')
    const appScan = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
    assertNoSeriousViolations('Main app view', appScan)
  })
})
