import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads and exposes expected DOM structure', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Cortex/i);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.locator('section#product').first()).toBeVisible();
    await expect(page.locator('section#features').first()).toBeVisible();

    const domMap = await page.evaluate(() => {
      const main = document.querySelector('main');
      const sections = Array.from(document.querySelectorAll('main section')).map((section) => ({
        id: section.id || null,
        className: section.className || null,
        heading: section.querySelector('h1, h2, h3')?.textContent?.trim() ?? null,
        buttonLike: Array.from(section.querySelectorAll('a, button'))
          .slice(0, 5)
          .map((el) => (el.textContent || '').trim())
          .filter(Boolean),
      }));

      return {
        root: {
          header: !!document.querySelector('header'),
          main: !!main,
          footer: !!document.querySelector('footer'),
        },
        sections,
      };
    });

    console.log('HOMEPAGE_DOM_MAP', JSON.stringify(domMap, null, 2));
  });

  test('main CTA can be clicked', async ({ page }) => {
    await page.goto('/');

    const primaryCta = page.locator('main').getByRole('link', { name: 'Get Started Free' }).first();
    await expect(primaryCta).toBeVisible();
    await primaryCta.click();

    await expect(page).toHaveURL(/\/signup$/);
  });
});
