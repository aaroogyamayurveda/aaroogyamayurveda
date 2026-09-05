const { test, expect } = require('@playwright/test');

async function login(page, key) {
  const email = process.env[`CRM1_${key}_EMAIL`];
  const password = process.env[`CRM1_${key}_PASSWORD`];
  expect(email, `Missing CRM1_${key}_EMAIL secret`).toBeTruthy();
  expect(password, `Missing CRM1_${key}_PASSWORD secret`).toBeTruthy();
  await page.goto('/crm1/', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#loginForm button[type="submit"]').click();
  await expect.poll(async () => {
    if (await page.locator('#app').isVisible().catch(() => false)) return 'app';
    const msg = (await page.locator('#loginMsg').innerText().catch(() => '')).trim();
    if (msg && !/Login हो रहा है/.test(msg)) return `error:${msg}`;
    return 'pending';
  }, { timeout: 45000, intervals: [250, 500, 1000, 2000] }).toMatch(/^app$/);
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i, { timeout: 15000 });
}

async function openAdvancedReports(page) {
  const reportBtn = page.locator('#nav button:visible').filter({ hasText: /Advanced Reports/i }).first();
  await expect(reportBtn).toHaveCount(1, { timeout: 10000 });
  await reportBtn.click();
  await expect(page.locator('#advancedReports')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#crm1ARDetailedRoot')).toBeVisible({ timeout: 10000 });
}

async function assertDetailedReport(page) {
  const main = page.locator('main');
  await expect(page.locator('#crm1ARFrom')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#crm1ARTo')).toBeVisible();
  await expect(page.locator('#crm1ARApply')).toBeVisible();
  await expect(page.locator('#crm1ARToday')).toBeVisible();
  await expect(main).toContainText(/Status Performance/i);
  await expect(main).toContainText(/Product Performance/i);
  await expect(main).toContainText(/Delivery %/i);
  await expect(main).toContainText(/Revenue/i);
  const from = '2026-08-01', to = '2026-08-25';
  await page.locator('#crm1ARFrom').fill(from);
  await page.locator('#crm1ARTo').fill(to);
  await page.locator('#crm1ARApply').click();
  await expect(page.locator('#crm1ARMsg')).toContainText(new RegExp(`Report: ${from} to ${to}`), { timeout: 15000 });
  await expect(main).not.toContainText(/Your dealer performance and delivery report|Your courier performance and delivery report/i);
}

test('Dealer Advanced Reports keeps detailed date range core report after delayed modules', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page, 'DEALER');
  await openAdvancedReports(page);
  await assertDetailedReport(page);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Courier Advanced Reports opens the authoritative detailed business report and date range controls', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page, 'COURIER');
  await openAdvancedReports(page);
  await assertDetailedReport(page);
  expect(errors, errors.join('\n')).toEqual([]);
});
