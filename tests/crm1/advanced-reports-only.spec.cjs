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

async function assertDealerReport(page) {
  const main = page.locator('main');
  await expect(page.locator('#crm1ARDetailedRoot')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#crm1ARFrom')).toBeVisible();
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
  await expect(main).not.toContainText(/Your dealer performance and delivery report/i);
  await page.waitForTimeout(15000);
  const finalText = await main.innerText();
  expect(finalText).toMatch(/Status Performance/i);
  expect(finalText).toMatch(/Product Performance/i);
  expect(finalText).toMatch(/Delivery %/i);
  expect(finalText).toMatch(/Revenue/i);
  expect(finalText).not.toMatch(/Total Assigned/i);
  expect(finalText).not.toMatch(/Your dealer performance and delivery report/i);
}

async function assertCourierReport(page) {
  const main = page.locator('main');
  await expect(main).toContainText(/Your courier performance and delivery report/i);
  await expect(main).toContainText(/Total Assigned/i);
  await expect(main).toContainText(/Delivered/i);
  await expect(main).toContainText(/In Progress/i);
  await expect(main).toContainText(/RTO/i);
  await expect(main).toContainText(/Cancelled/i);
  await expect(main).toContainText(/Order Value/i);
  await expect(main).toContainText(/Status-wise Report/i);

  const from = '2026-08-01', to = '2026-08-25';
  const inputs = page.locator('main input[type="date"]:visible');
  const inputCount = await inputs.count();
  expect(inputCount, 'Courier Advanced Reports visible date range controls are missing').toBeGreaterThanOrEqual(2);
  await inputs.nth(0).fill(from);
  await inputs.nth(1).fill(to);
  const apply = page.locator('main button:visible').filter({ hasText: /^Apply$/i }).first();
  await expect(apply).toHaveCount(1);
  await apply.click();
  await expect(main).toContainText(/Your courier performance and delivery report/i, { timeout: 15000 });
  await page.waitForTimeout(15000);
  const finalText = await main.innerText();
  expect(finalText).toMatch(/Your courier performance and delivery report/i);
  expect(finalText).toMatch(/Total Assigned/i);
  expect(finalText).toMatch(/Delivered/i);
  expect(finalText).toMatch(/Status-wise Report/i);
}

test('Dealer Advanced Reports keeps detailed date range core report after delayed modules', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page, 'DEALER');
  const reportBtn = page.locator('#nav button:visible').filter({ hasText: /Advanced Reports/i }).first();
  await expect(reportBtn).toHaveCount(1);
  await reportBtn.click();
  await expect(page.locator('main')).toContainText(/Advanced Reports/i);
  await assertDealerReport(page);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Courier Advanced Reports keeps courier performance report after delayed modules', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page, 'COURIER');
  const reportBtn = page.locator('#nav button:visible').filter({ hasText: /Advanced Reports/i }).first();
  await expect(reportBtn).toHaveCount(1);
  await reportBtn.click();
  await expect(page.locator('main')).toContainText(/Advanced Reports/i);
  await assertCourierReport(page);
  expect(errors, errors.join('\n')).toEqual([]);
});
