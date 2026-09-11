import { test, expect } from '@playwright/test';

test('homepage has SealShell in title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/SealShell/);
});
