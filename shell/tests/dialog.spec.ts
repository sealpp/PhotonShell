import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/dialog-harness.html')
})

test('moves focus into the dialog and restores it after Escape', async ({ page }) => {
  const input = page.locator('#dialog-input')
  const close = page.getByRole('button', { name: '关闭' })
  await expect(close).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(input).toBeHidden()

  await page.locator('#open').click()
  await expect(close).toBeFocused()
})

test('closes from the dialog action', async ({ page }) => {
  await page.locator('#confirm').click()
  await expect(page.getByRole('dialog')).toBeHidden()
})
