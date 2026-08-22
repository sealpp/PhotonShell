import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/alert-dialog-harness.html')
})

test('does not dismiss on an outside click', async ({ page }) => {
  await page.mouse.click(10, 10)
  await expect(page.getByRole('alertdialog')).toBeVisible()
})

test('closes through cancel without confirming', async ({ page }) => {
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
  await expect(page.locator('#confirmed')).toHaveText('false')
})

test('confirms through the destructive action', async ({ page }) => {
  await page.getByRole('button', { name: '删除' }).click()
  await expect(page.getByRole('alertdialog')).toBeHidden()
  await expect(page.locator('#confirmed')).toHaveText('true')
})
