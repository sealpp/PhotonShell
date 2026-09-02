import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/workbench-menu-harness.html')
})

async function openMenu(page: Page) {
  await page.locator('.workbench-menu-trigger').click()
  await expect(page.getByRole('menu')).toBeVisible()
}

test('opens an upward menu from the bottom of the left activity bar', async ({ page }) => {
  const trigger = page.locator('.workbench-menu-trigger')
  await expect(trigger).toHaveAttribute('aria-label', '设置和关于')
  await trigger.click()

  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu).toHaveCSS('min-width', '160px')
  await expect(menu.getByRole('menuitem')).toHaveCount(3)
  await expect(menu.getByRole('menuitem', { name: '键盘快捷键' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '设置' })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: '关于' })).toBeVisible()
  await expect(menu.getByRole('separator')).toHaveCount(1)

  const triggerBox = await trigger.boundingBox()
  const menuBox = await menu.boundingBox()
  expect(triggerBox).not.toBeNull()
  expect(menuBox).not.toBeNull()
  expect(triggerBox!.x).toBeCloseTo(0, 0)
  expect(triggerBox!.width).toBeCloseTo(48, 0)
  expect(triggerBox!.height).toBeCloseTo(48, 0)
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(triggerBox!.y + 1)
  expect(triggerBox!.y + triggerBox!.height).toBeCloseTo(page.viewportSize()!.height - 24, 0)
  expect(menuBox!.x).toBeGreaterThanOrEqual(0)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
})

test('opens the empty settings dialog and supports standard dismissal', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('menuitem', { name: '设置' }).click()

  await expect(page.getByRole('menu')).toBeHidden()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '设置' })).toBeVisible()
  await expect(dialog.locator('.workbench-dialog-description')).toHaveCount(1)
  await expect(dialog.locator('.workbench-dialog-description')).toHaveCSS('position', 'absolute')
  await expect(dialog.locator('.workbench-dialog-description')).toHaveCSS('width', '1px')
  await expect(dialog.locator('.workbench-dialog-body')).toHaveText('')

  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.width).toBeCloseTo(page.viewportSize()!.width * 0.8, 0)
  expect(dialogBox!.height).toBeCloseTo(page.viewportSize()!.height * 0.8, 0)

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await openMenu(page)
  await page.getByRole('menuitem', { name: '设置' }).click()
  await page.mouse.click(4, 4)
  await expect(page.getByRole('dialog')).toBeHidden()
})

test('opens the minimal about dialog with the PhotonShell logo', async ({ page }) => {
  await openMenu(page)
  await page.getByRole('menuitem', { name: '关于' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.about-dialog-logo')).toHaveAttribute('src', '/icon.svg')
  await expect(dialog.locator('.about-dialog-body > span')).toHaveText('PhotonShell')
  await expect(dialog.locator('.workbench-dialog-title')).toHaveCSS('position', 'absolute')
  await expect(dialog.locator('.workbench-dialog-title')).toHaveCSS('width', '1px')

  const logoBox = await dialog.locator('.about-dialog-logo').boundingBox()
  const dialogBox = await dialog.boundingBox()
  expect(logoBox).not.toBeNull()
  expect(dialogBox).not.toBeNull()
  expect(logoBox!.width).toBeCloseTo(64, 0)
  expect(logoBox!.height).toBeCloseTo(64, 0)
  expect(dialogBox!.width).toBeCloseTo(320, 0)

  await dialog.getByRole('button', { name: '关闭' }).click()
  await expect(dialog).toBeHidden()
})

test('keeps the dialogs within the viewport on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/tests/workbench-menu-harness.html')

  await openMenu(page)
  await page.getByRole('menuitem', { name: '设置' }).click()
  const settingsBox = await page.getByRole('dialog').boundingBox()
  expect(settingsBox).not.toBeNull()
  expect(settingsBox!.width).toBeLessThanOrEqual(375 * 0.9)
  expect(settingsBox!.height).toBeLessThanOrEqual(667 * 0.9)

  await page.keyboard.press('Escape')
  await openMenu(page)
  await page.getByRole('menuitem', { name: '关于' }).click()
  const aboutBox = await page.getByRole('dialog').boundingBox()
  expect(aboutBox).not.toBeNull()
  expect(aboutBox!.width).toBeLessThanOrEqual(375 * 0.9)
})
