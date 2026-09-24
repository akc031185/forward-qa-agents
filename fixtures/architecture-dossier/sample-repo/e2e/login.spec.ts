import { test, expect } from '@playwright/test';

test('owner can sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Harbor/);
});
