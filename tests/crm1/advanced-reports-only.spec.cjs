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

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await page.locator('#app').isVisible().catch(() => false)) break;
    await page.waitForTimeout(250);
  }

  if (!(await page.locator('#app').isVisible().catch(() => false))) {
    const msg = (await page.locator('#loginMsg').innerText().catch(() => '')).trim();
    throw new Error(`${key} login did not open CRM1 app. LoginMessage=${msg || '(empty)'}; URL=${page.url()}`);
  }

  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i);
  await page.waitForTimeout(1800);
}

async function assertStableAdvancedReports(page, key) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await login(page, key);

  const reportBtn = page.locator('#nav button').filter({ hasText: /Advanced Reports/i }).first();
  await expect(reportBtn).toHaveCount(1);
  await reportBtn.click();

  const main = page.locator('main');
  await expect(main).toContainText(/Advanced Reports/i);
  await expect(main).toContainText(/Status Performance/i, { timeout: 10000 });
  await expect(main).toContainText(/Product Performance/i, { timeout: 10000 });
  await expect(main).toContainText(/Delivery %/i);
  await expect(main).toContainText(/Revenue/i);
  await expect(main).not.toContainText(/Total Assigned/i);
  await expect(main).not.toContainText(/Your dealer performance and delivery report/i);

  // The live bug appears a couple of seconds after the first report renders.
  await page.waitForTimeout(3500);
  const after3500ms = await main.innerText();
  expect(after3500ms).toMatch(/Status Performance/i);
  expect(after3500ms).toMatch(/Product Performance/i);
  expect(after3500ms).toMatch(/Delivery %/i);
  expect(after3500ms).not.toMatch(/Total Assigned/i);
  expect(after3500ms).not.toMatch(/Your dealer performance and delivery report/i);

  // Final regression check: it must remain the same report after delayed modules settle.
  await page.waitForTimeout(11500);
  const finalText = await main.innerText();
  expect(finalText).toMatch(/Advanced Reports/i);
  expect(finalText).toMatch(/Status Performance/i);
  expect(finalText).toMatch(/Product Performance/i);
  expect(finalText).toMatch(/Delivery %/i);
  expect(finalText).toMatch(/Revenue/i);
  expect(finalText).not.toMatch(/Total Assigned/i);
  expect(finalText).not.toMatch(/Your dealer performance and delivery report/i);
  expect(finalText).not.toMatch(/^\s*Loading…?\s*$/i);
  expect(errors, errors.join('\n')).toEqual([]);
}

test('Dealer Advanced Reports stays on the core report after delayed modules', async ({ page }) => {
  await assertStableAdvancedReports(page, 'DEALER');
});

test('Courier Advanced Reports stays on the core report after delayed modules', async ({ page }) => {
  await assertStableAdvancedReports(page, 'COURIER');
});
