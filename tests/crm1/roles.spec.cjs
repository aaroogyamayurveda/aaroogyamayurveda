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

  const deadline = Date.now() + 15000;
  let loginMessage = '';
  while (Date.now() < deadline) {
    if (await page.locator('#app').isVisible().catch(() => false)) break;
    loginMessage = (await page.locator('#loginMsg').innerText().catch(() => '')).trim();
    if (loginMessage && !/Login हो रहा है/.test(loginMessage)) break;
    await page.waitForTimeout(250);
  }

  if (!(await page.locator('#app').isVisible().catch(() => false))) {
    loginMessage = (await page.locator('#loginMsg').innerText().catch(() => loginMessage)).trim();
    throw new Error(`${key} login did not open CRM1 app. LoginMessage=${loginMessage || '(empty)'}; URL=${page.url()}`);
  }

  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i);
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
  await expect(activePage.locator('#crm1PartnerOrdersFinal')).toBeVisible({timeout:10000});
  await expect(activePage.locator('#crm1PartnerOrdersFinal table thead')).toContainText(/Update/i,{timeout:10000});

  const headerText = await activePage.locator('#crm1PartnerOrdersFinal table thead').innerText();
  expect(headerText).toMatch(/Customer/i);
  expect(headerText).toMatch(/Mobile/i);
  expect(headerText).toMatch(/Product/i);
  expect(headerText).toMatch(/Status/i);
  expect(headerText).toMatch(/Update/i);

  const rows = await activePage.locator('#crm1PartnerOrdersFinal table tbody tr').count();
  expect(rows).toBeGreaterThanOrEqual(1);

  const settlementBtn = nav.locator('button:visible').filter({hasText:/Settlements/i}).first();
  if (await settlementBtn.count()) {
    await settlementBtn.click();
    await expect(page.locator('main')).toContainText(/Your Settlements|No settlements found/i,{timeout:10000});
    await expect(page.locator('main')).not.toContainText(/Generate Settlement/i);
  }

  const reportBtn = nav.locator('button:visible').filter({hasText:/Advanced Reports/i}).first();
  await reportBtn.click();
  await expect(page.locator('main')).toContainText(/Advanced Reports/i);
  await expect(page.locator('main')).toContainText(/Orders/i,{timeout:10000});
  await expect(page.locator('main')).toContainText(/Delivered/i);

  // Regression check: partner Advanced Reports must stay on the same core report
  // after delayed modules finish loading; it must not switch to the detailed
  // Total Assigned / dealer-performance view.
  await page.waitForTimeout(15000);
  await expect(page.locator('main')).toContainText(/Advanced Reports/i);
  await expect(page.locator('main')).toContainText(/Orders/i);
  await expect(page.locator('main')).toContainText(/Delivered/i);
  await expect(page.locator('main')).not.toContainText(/Total Assigned/i);
  await expect(page.locator('main')).not.toContainText(/Your dealer performance and delivery report/i);
  await expect(page.locator('.crm1-stability-loading')).toHaveCount(0);
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
