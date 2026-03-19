import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page, request }) => {
  const testEmail = `testuser_${Date.now()}@example.com`;

  // Try to create the mock user first
  try {
    await request.post('http://127.0.0.1:8080/api/v1/auth/signup', {
      data: {
        email: testEmail,
        password: 'Password123!',
        fullName: 'Test User'
      }
    });
  } catch (e) {
    console.error("Setup signup error (might be expected if already exists):", e);
  }

  await page.goto('/login');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'Password123!');
  await page.click('button[type="submit"]');

  await page.waitForURL('/dashboard', { timeout: 30000 });
  await expect(page.locator('text=Test User').first()).toBeVisible({ timeout: 10000 });

  await page.context().storageState({ path: authFile });
});
