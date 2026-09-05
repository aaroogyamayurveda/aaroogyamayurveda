const { test, expect } = require('@playwright/test');

const roles = [
  ['SUPER_ADMIN','Super Admin'], ['MANAGER','Manager'], ['AGENT','Agent'], ['DEALER','Dealer'], ['COURIER','Courier']
];

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
  await page.waitForTimeout(1800);
}

async function assertPartnerRole(page, key, orderLabel) {
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await login(page, key);

  const nav = page.locator('#nav');
  await expect(nav.locator('button:visible').filter({hasText:new RegExp(orderLabel,'i')})).toHaveCount(1);
  await expect(nav.locator('button:visible').filter({hasText:/Advanced Reports/i})).toHaveCount(1);
  await expect(nav.locator('button:visible').filter({hasText:/Order Timeline/i})).toHaveCount(0);
  await expect(nav.locator('button:visible').filter({hasText:/Conversion Workbench/i})).toHaveCount(0);

  const orderBtn = nav.locator('button:visible').filter({hasText:new RegExp(orderLabel,'i')}).first();
  await orderBtn.click();
  const activePage = page.locator('.page.active').first();
  await expect(activePage).toBeVisible({timeout:10000});
  await expect(activePage).toContainText(orderLabel);
  const partnerPanel = activePage.locator('[data-crm1-partner-orders="1"], #crm1PartnerOrdersFinal').first();
  await expect(partnerPanel).toBeVisible({timeout:15000});
  await expect(partnerPanel.locator('table thead')).toContainText(/Customer|Customer Name/i,{timeout:10000});

  const headerText = await partnerPanel.locator('table thead').innerText();
  expect(headerText).toMatch(/Customer/i);
  expect(headerText).toMatch(/Mobile/i);
  expect(headerText).toMatch(/Product/i);
  expect(headerText).toMatch(/Status/i);
  expect(headerText).toMatch(/Update Status|Update/i);

  const rows = await partnerPanel.locator('table tbody tr').count();
  expect(rows).toBeGreaterThanOrEqual(1);

  const settlementBtn = nav.locator('button:visible').filter({hasText:/Settlements/i}).first();
  if (await settlementBtn.count()) {
    await settlementBtn.click();
    await expect(page.locator('main')).toContainText(/Settlements|Settlement|No settlements found|Statement/i,{timeout:10000});
    await expect(page.locator('main')).not.toContainText(/Generate Settlement/i);
  }

  const reportBtn = nav.locator('button:visible').filter({hasText:/Advanced Reports/i}).first();
  await reportBtn.click();
  await expect(page.locator('main')).toContainText(/Advanced Reports/i,{timeout:10000});
  await expect(page.locator('main')).toContainText(/Status Performance|Product Performance|Delivery %/i,{timeout:15000});
  await expect(page.locator('.crm1-stability-loading')).toHaveCount(0,{timeout:15000});
  await expect(page.locator('main')).not.toHaveText(/^\s*Loading…?\s*$/i);
  expect(errors, errors.join('\n')).toEqual([]);
}

for (const [key, label] of roles) {
  test(`${label} can authenticate into CRM1`, async ({ page }) => {
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await login(page, key);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('Dealer role: assigned orders show customer, mobile, product, status update, own settlements and reports', async ({ page }) => {
  await assertPartnerRole(page, 'DEALER', 'Dealer Orders');
});

test('Courier role: assigned orders show customer, mobile, product, status update, own settlements and reports', async ({ page }) => {
  await assertPartnerRole(page, 'COURIER', 'Courier Orders');
});
