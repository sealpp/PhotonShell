import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/workspace-docking-harness.html')
  await page.locator('.workspace-panel').waitFor()
})

test('keeps fixed categories and shows only the selected category instances', async ({ page }) => {
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(page.locator('.workspace-category-view.active .workspace-instance')).toHaveCount(3)
  const dockBox = await page.locator('.workspace-category-view.active .workspace-dockview').boundingBox()
  expect(dockBox?.height ?? 0).toBeGreaterThan(0)

  await page.getByRole('tab', { name: '文件', exact: true }).click()
  await expect(page.locator('.workspace-category-view.active .workspace-instance')).toHaveCount(1)
  await expect(page.locator('.workspace-category-view.active .workspace-instance-label')).toContainText('README.md')
})

test('keeps grouped markers stable and activates tabs across panes', async ({ page }) => {
  const dock = page.locator('.workspace-category-view.active .workspace-dock')
  const source = page.getByRole('button', { name: '远端 /opt' })
  const [dockBox, sourceBox] = await Promise.all([dock.boundingBox(), source.boundingBox()])
  expect(dockBox).not.toBeNull()
  expect(sourceBox).not.toBeNull()
  if (!dockBox || !sourceBox) return

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sourceBox.x - 40, sourceBox.y + sourceBox.height / 2, { steps: 4 })
  await page.mouse.move(dockBox.x + 12, dockBox.y + dockBox.height / 2, { steps: 12 })
  await page.mouse.up()

  const instances = page.locator('.workspace-category-view.active .workspace-instance')
  await expect(instances.locator('.workspace-instance-label')).toHaveText(['远端 /opt', '远端 /srv', '远端 /var'])
  await expect(instances.locator('.workspace-instance-marker')).toHaveText(['┌', '└', ''])

  await page.getByRole('button', { name: '远端 /var' }).click()
  await expect(page.getByRole('region', { name: '远端 /var' })).toBeVisible()
  await expect(page.getByRole('region', { name: '远端 /srv' })).toBeHidden()
  await expect(page.getByRole('region', { name: '远端 /opt' })).toBeHidden()
  await expect(instances.locator('.workspace-instance-marker')).toHaveText(['┌', '└', ''])

  await page.getByRole('button', { name: '远端 /opt' }).click()
  await expect(page.getByRole('button', { name: '远端 /opt' })).toHaveClass(/active/)
  await expect(page.getByRole('region', { name: '远端 /srv' })).toBeVisible()
  await expect(page.getByRole('region', { name: '远端 /var' })).toBeHidden()
})

test('selects an instance without changing the other category layout', async ({ page }) => {
  const first = page.locator('.workspace-category-view.active .workspace-instance').nth(1)
  await first.click()
  await expect(first).toHaveClass(/active/)
  await page.getByRole('tab', { name: '文件', exact: true }).click()
  await expect(page.locator('.workspace-category-view.active .workspace-instance')).toHaveCount(1)
  await page.getByRole('tab', { name: '文件列表' }).click()
  await expect(page.locator('.workspace-category-view.active .workspace-instance').nth(1)).toHaveClass(/active/)
})

test('opens the file context menu from a file row', async ({ page }) => {
  const row = page.locator('.workspace-category-view.active .file-row:visible').filter({ hasText: 'README.md' }).last()
  await expect(row).toBeVisible()
  await row.click({ button: 'right' })
  await expect(page.locator('[role="menu"]:visible')).toBeVisible()
})

test('provides panel maximize, restore, and close controls', async ({ page }) => {
  const panel = page.locator('.workspace-panel')
  await expect(panel).toHaveAttribute('aria-label', '面板')

  await page.getByRole('button', { name: '最大化面板' }).click()
  await expect(panel).toHaveClass(/maximized/)
  await expect(page.getByRole('button', { name: '恢复面板大小' })).toBeVisible()

  await page.getByRole('button', { name: '恢复面板大小' }).click()
  await expect(panel).not.toHaveClass(/maximized/)

  await page.getByRole('button', { name: '关闭面板' }).click()
  await expect(panel).toBeHidden()
})
