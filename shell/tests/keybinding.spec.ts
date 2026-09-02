import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/keybinding-harness.html')
})

test('dispatches a registered Mod binding and formats its label', async ({ page }) => {
  await expect(page.locator('#label')).toHaveText('Ctrl+K')
  await page.keyboard.press('Control+K')
  await expect(page.locator('#count')).toHaveText('1')
})

test('does not dispatch global bindings from text inputs', async ({ page }) => {
  await page.locator('#input').focus()
  await page.keyboard.press('Control+K')
  await expect(page.locator('#count')).toHaveText('0')

  await page.locator('#editable').focus()
  await page.keyboard.press('Control+K')
  await expect(page.locator('#count')).toHaveText('0')
})

test('replaces and resets runtime keybinding overrides', async ({ page }) => {
  await page.evaluate(() => {
    const testWindow = window as unknown as Window & {
      setTestOverride: () => void
      resetTestOverride: () => void
    }
    testWindow.setTestOverride()
  })

  await page.keyboard.press('Control+K')
  await expect(page.locator('#count')).toHaveText('0')
  await page.keyboard.press('Control+L')
  await expect(page.locator('#count')).toHaveText('1')

  await page.evaluate(() => {
    const testWindow = window as unknown as Window & { resetTestOverride: () => void }
    testWindow.resetTestOverride()
  })
  await page.keyboard.press('Control+K')
  await expect(page.locator('#count')).toHaveText('2')
})
