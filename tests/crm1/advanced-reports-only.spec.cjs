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
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await page.locator('#app').isVisible().catch(() => false)) break;
    const msg = (await page.locator('#loginMsg').innerText().catch(() => '')).trim();
    if (msg && !/Login हो रहा है/.test(msg)) break;
    await page.waitForTimeout(250);
  }
  if (!(await page.locator('#app').isVisible().catch(() => false))) {
    const msg = (await page.locator('#loginMsg').innerText().catch(() => '')).trim();
    throw new Error(`${key} login did not open CRM1 app. LoginMessage=${msg || '(empty)'}; URL=${page.url()}`);
  }
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i, { timeout: 10000 });
}

async function assertStableAdvancedReports(page, key) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await login(page, key);
  const reportBtn = page.locator('#nav button:visible').filter({ hasText: /Advanced Reports/i }).first();
  await expect(reportBtn).toHaveCount(1);
  await reportBtn.click();
  const main = page.locator('main');
  await expect(main).toContainText(/Advanced Reports/i);
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
  await expect(main).not.toContainText(/Total Assigned/i);
  await expect(main).not.toContainText(/Your dealer performance and delivery report/i);

  await page.waitForTimeout(15000);
  const finalText = await main.innerText();
  expect(finalText).toMatch(/Status Performance/i);
  expect(finalText).toMatch(/Product Performance/i);
  expect(finalText).toMatch(/Delivery %/i);
  expect(finalText).toMatch(/Revenue/i);
  expect(finalText).not.toMatch(/Total Assigned/i);
  expect(finalText).not.toMatch(/Your dealer performance and delivery report/i);
  expect(errors, errors.join('\n')).toEqual([]);
}

test('Dealer Advanced Reports keeps date range core report after delayed modules', async ({ page }) => {
  await assertStableAdvancedReports(page, 'DEALER');
});

test('Courier Advanced Reports keeps date range core report after delayed modules', async ({ page }) => {
  await assertStableAdvancedReports(page, 'COURIER');
});
