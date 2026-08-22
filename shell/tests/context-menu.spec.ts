import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/context-menu-harness.html')
  await page.locator('#trigger').click({ button: 'right' })
})

test('keeps an opened submenu while moving into it', async ({ page }) => {
  const menus = page.locator('[role="menu"]')

  await expect(menus).toHaveCount(1)
  await page.getByRole('menuitem', { name: '一级子菜单' }).hover()
  await expect(menus).toHaveCount(2)

  await page.getByRole('menuitem', { name: '二级普通项' }).hover()
  await expect(menus).toHaveCount(2)
})

test('routes keyboard navigation to the deepest submenu', async ({ page }) => {
  const menus = page.locator('[role="menu"]')

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await expect(menus).toHaveCount(2)
  await expect(page.getByRole('menuitem', { name: '二级普通项' })).toBeFocused()

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await expect(menus).toHaveCount(3)
  await expect(page.getByRole('menuitem', { name: '三级第一项' })).toBeFocused()
})

test('flips a submenu to the left at the viewport edge', async ({ page }) => {
  await page.getByRole('menuitem', { name: '一级子菜单' }).hover()
  await expect(page.locator('.command-menu-content[data-side="left"][aria-labelledby]')).toHaveCount(1)
})

test('dismisses the complete menu tree after executing a nested command', async ({ page }) => {
  const menus = page.locator('[role="menu"]')

  await page.getByRole('menuitem', { name: '一级子菜单' }).hover()
  await page.getByRole('menuitem', { name: '二级子菜单' }).hover()
  await page.getByRole('menuitem', { name: '三级第一项' }).click()

  await expect(page.locator('#app')).toHaveText('')
  await expect(menus).toHaveCount(0)
})
