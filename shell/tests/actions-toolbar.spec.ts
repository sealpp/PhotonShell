import { test, expect, type Page } from '@playwright/test'

async function splitSecondTab(page: Page) {
  const tab = page.locator('.terminal-tab').nth(1)
  await tab.waitFor()

  const tabBox = await tab.boundingBox()
  const dockBox = await page.locator('.main-dock-container').boundingBox()
  expect(tabBox).not.toBeNull()
  expect(dockBox).not.toBeNull()

  await page.mouse.move(tabBox!.x + 10, tabBox!.y + tabBox!.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.move(dockBox!.x + dockBox!.width - 2, dockBox!.y + dockBox!.height / 2, { steps: 30 })
  await page.waitForTimeout(700)
  await page.mouse.up()
  await expect(page.locator('.dv-groupview')).toHaveCount(2)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/actions-toolbar-harness.html')
  await page.locator('.actions-toolbar').waitFor()
})

test('renders workspace actions once on the Dockview tab row', async ({ page }) => {
  await splitSecondTab(page)

  const toolbar = page.locator('.actions-toolbar')
  const dock = page.locator('.main-dock-container')
  const header = page.locator('.dv-groupview .dv-tabs-and-actions-container').first()

  await expect(toolbar).toHaveCount(1)
  await expect(page.locator('.dv-groupview .tool-icon')).toHaveCount(0)
  await expect(toolbar).toHaveCSS('justify-content', 'flex-end')
  await expect(header).toHaveCSS('padding-right', '44px')

  const toolbarBox = await toolbar.boundingBox()
  const dockBox = await dock.boundingBox()
  const headerBox = await header.boundingBox()
  expect(toolbarBox).not.toBeNull()
  expect(dockBox).not.toBeNull()
  expect(headerBox).not.toBeNull()
  expect(toolbarBox!.x + toolbarBox!.width).toBeCloseTo(dockBox!.x + dockBox!.width, 0)
  expect(toolbarBox!.y).toBeCloseTo(headerBox!.y, 0)
  expect(toolbarBox!.height).toBeCloseTo(headerBox!.height, 0)
})

test('keeps the monitor toggle behavior in the global toolbar', async ({ page }) => {
  const button = page.getByRole('button', { name: '系统监控' })
  const panel = page.locator('.panel')

  await expect(panel).not.toHaveClass(/collapsed/)
  await expect(button).toHaveAttribute('aria-pressed', 'true')

  await button.click()
  await expect(panel).toHaveClass(/collapsed/)
  await expect(button).toHaveAttribute('aria-pressed', 'false')

  await button.click()
  await expect(panel).not.toHaveClass(/collapsed/)
  await expect(button).toHaveAttribute('aria-pressed', 'true')
})
