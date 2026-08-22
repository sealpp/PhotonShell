import { test, expect } from '@playwright/test'

const delay = 230

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/context-menu-harness.html')
})

test('keeps an opened submenu while moving into it and closes descendants by level', async ({ page }) => {
  const menus = page.locator('.context-menu')

  await page.getByRole('button', { name: '一级子菜单' }).hover()
  await expect(menus).toHaveCount(2)

  await page.getByRole('button', { name: '二级普通项' }).hover()
  await page.waitForTimeout(delay)
  await expect(menus).toHaveCount(2)

  await page.getByRole('button', { name: '二级子菜单' }).hover()
  await expect(menus).toHaveCount(3)

  await page.getByRole('button', { name: '三级第一项' }).hover()
  await page.waitForTimeout(delay)
  await expect(menus).toHaveCount(3)

  await page.getByRole('button', { name: '一级子菜单' }).hover()
  await page.waitForTimeout(delay)
  await expect(menus).toHaveCount(2)

  await page.getByRole('button', { name: '一级普通项' }).hover()
  await page.waitForTimeout(delay)
  await expect(menus).toHaveCount(1)
})

test('routes keyboard navigation to the deepest submenu exactly once', async ({ page }) => {
  const menus = page.locator('.context-menu')

  await page.getByRole('button', { name: '一级子菜单' }).hover()
  await expect(menus).toHaveCount(2)
  await page.getByRole('button', { name: '二级子菜单' }).hover()
  await expect(menus).toHaveCount(3)

  await page.keyboard.press('ArrowDown')
  await expect(menus.last().locator('.context-menu-item.active')).toHaveText('三级第一项')

  await page.keyboard.press('ArrowDown')
  await expect(menus.last().locator('.context-menu-item.active')).toHaveText('三级第二项')

  await page.keyboard.press('ArrowLeft')
  await expect(menus).toHaveCount(2)

  await page.keyboard.press('ArrowDown')
  await expect(menus.last().locator('.context-menu-item.active')).toHaveText('二级普通项')
})

test('dismisses the complete menu tree after executing a nested command', async ({ page }) => {
  const menus = page.locator('.context-menu')

  await page.getByRole('button', { name: '一级子菜单' }).hover()
  await expect(menus).toHaveCount(2)
  await page.getByRole('button', { name: '二级子菜单' }).hover()
  await expect(menus).toHaveCount(3)

  await page.getByRole('button', { name: '三级第一项' }).click()
  await expect(menus).toHaveCount(0)
})
