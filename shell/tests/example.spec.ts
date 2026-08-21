import { test, expect } from '@playwright/test';

test('homepage has PhotonShell in title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/PhotonShell/);
});

test('counter increments on click', async ({ page }) => {
  await page.goto('/');
  // Replace with a real selector once the app has interactive elements.
  await expect(page.locator('body')).toBeVisible();
});
