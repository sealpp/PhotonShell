import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/workspace-docking-harness.html')
  await page.locator('.workspace-panel').waitFor()
})

test('keeps fixed categories and shows only the selected category instances', async ({ page }) => {
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(page.locator('.workspace-category-view.active .workspace-instance')).toHaveCount(2)
  const dockBox = await page.locator('.workspace-category-view.active .workspace-dockview').boundingBox()
  expect(dockBox?.height ?? 0).toBeGreaterThan(0)

  await page.getByRole('tab', { name: '文件' }).click()
  await expect(page.locator('.workspace-category-view.active .workspace-instance')).toHaveCount(1)
  await expect(page.locator('.workspace-instance-label')).toContainText('README.md')
})

test('selects an instance without changing the other category layout', async ({ page }) => {
  const first = page.locator('.workspace-category-view.active .workspace-instance').nth(1)
  await first.click()
  await expect(first).toHaveClass(/active/)
  await page.getByRole('tab', { name: '文件' }).click()
  await expect(page.locator('.workspace-category-view.active .workspace-instance')).toHaveCount(1)
  await page.getByRole('tab', { name: '文件列表' }).click()
  await expect(page.locator('.workspace-category-view.active .workspace-instance').nth(1)).toHaveClass(/active/)
})

test('opens the file context menu from a file row', async ({ page }) => {
  const row = page.locator('.workspace-category-view.active .file-row').filter({ hasText: 'README.md' }).last()
  await expect(row).toBeVisible()
  await row.click({ button: 'right' })
  await expect(page.locator('[role="menu"]')).toBeVisible()
})
