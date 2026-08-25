const { test, expect } = require('@playwright/test');

const errors = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/favicon\.ico|Failed to load resource/i.test(t)) errors.push(`CONSOLE: ${t}`);
    }
  });
});

test('CRM1 public startup is stable', async ({ page }) => {
  await page.goto('/crm1/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  await page.waitForTimeout(4000);
  expect(errors, errors.join('\n')).toEqual([]);
});
