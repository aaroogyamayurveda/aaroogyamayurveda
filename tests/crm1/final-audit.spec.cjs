const { test, expect } = require('@playwright/test');

const roles = [
  ['SUPER_ADMIN', /Super Admin/i], ['MANAGER', /Manager|Management/i], ['AGENT', /Agent/i], ['DEALER', /Dealer/i], ['COURIER', /Courier/i]
];

async function login(page, key) {
  const email = process.env[`CRM1_${key}_EMAIL`];
  const password = process.env[`CRM1_${key}_PASSWORD`];
  expect(email, `Missing CRM1_${key}_EMAIL secret`).toBeTruthy();
  expect(password, `Missing CRM1_${key}_PASSWORD secret`).toBeTruthy();
  await page.goto('/crm1/', { waitUntil: 'domcontentloaded' });
  await page.locator('#loginForm').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#loginForm button[type="submit"]').click();
  await expect.poll(async () => {
    if (await page.locator('#app').isVisible().catch(() => false)) return 'app';
    const msg = (await page.locator('#loginMsg').innerText().catch(() => '')).trim();
    if (msg && !/Login हो रहा है/.test(msg)) return `error:${msg}`;
    return 'pending';
  }, { timeout: 45000, intervals: [250, 500, 1000, 2000] }).toMatch(/^app$/);
  await expect(page.locator('#app')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i, { timeout: 15000 });
}

async function expandNavigation(page) {
  const groups = page.locator('#nav .crm1-nav-group');
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    const group = groups.nth(i);
    const body = group.locator('.crm1-nav-group-body');
    if (!(await body.isVisible().catch(() => false))) await group.locator('.crm1-nav-group-title').click().catch(() => {});
  }
}

async function assertActivePageReady(page, role, label) {
  const active = page.locator('.page.active').first();
  await expect(active, `${role}: ${label} active page missing`).toBeVisible({ timeout: 15000 });
  await expect.poll(async () => {
    const text = (await active.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    return text.length;
  }, { timeout: 30000, intervals: [250, 500, 1000, 2000] }).toBeGreaterThan(20);
  const text = (await active.innerText()).replace(/\s+/g, ' ').trim();
  expect(text, `${role}: ${label} stuck on loading`).not.toMatch(/^Loading…?$/i);
}

async function clickIfPresent(page, pattern, options = {}) {
  await expandNavigation(page);
  const candidates = page.locator('#nav .crm1-nav-group-body > button:visible, #nav > button:visible');
  const btn = candidates.filter({ hasText: pattern }).first();
  const timeout = options.timeout || 10000;
  if (!(await btn.count().catch(() => 0))) return false;
  try { await btn.click({ timeout }); } catch (e) {
    if (options.required) throw e;
    return false;
  }
  await assertActivePageReady(page, options.role || 'CRM1', String(pattern));
  return true;
}

async function assertNoRuntimeErrors(errors, label) {
  expect(errors, `${label} page errors:\n${errors.join('\n')}`).toEqual([]);
}

test.describe('CRM1 FINAL END-TO-END AUDIT', () => {
  test('all authenticated roles: every visible CRM page opens with real content', async ({ page }) => {
    test.setTimeout(240000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [key, expectedRole] of roles) {
      errors.length = 0;
      await login(page, key);
      await expect(page.locator('#userInfo')).toContainText(expectedRole);
      await expandNavigation(page);
      const nav = page.locator('#nav .crm1-nav-group-body > button:visible, #nav > button:visible');
      const count = await nav.count();
      expect(count, `${key} has no navigation pages`).toBeGreaterThan(0);
      const labels = [];
      for (let i = 0; i < count; i++) {
        const label = (await nav.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (label) labels.push(label);
      }
      for (const label of [...new Set(labels)]) {
        await expandNavigation(page);
        const btn = page.locator('#nav .crm1-nav-group-body > button:visible, #nav > button:visible').filter({ hasText: label }).first();
        if (!(await btn.count().catch(() => 0))) continue;
        await btn.click({ timeout: 10000 });
        await assertActivePageReady(page, key, label);
      }
      assertNoRuntimeErrors(errors, key);
      await page.locator('#logout').click();
      await page.waitForTimeout(400);
    }
  });

  test('Agent: todays calling queue -> call context -> create order/disposition UI is wired', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page, 'AGENT');
    await expandNavigation(page);
    const queueBtn = page.locator('#nav button:visible').filter({ hasText: /Today.?s Calling Queue/i }).first();
    await expect(queueBtn).toHaveCount(1, { timeout: 15000 });
    await queueBtn.click({ timeout: 10000 });
    const queue = page.locator('#crm1W2Queue');
    await expect(queue).toBeVisible({ timeout: 15000 });
    await expect(queue).toContainText(/Today.?s Calling Queue|No leads|No assigned|Calling Queue/i, { timeout: 15000 });
    const callBtn = page.locator('#crmW2QueueBody button, #crmLeadBody .crmLeadCall').filter({ hasText: /Call|Dial/i }).first();
    if (await callBtn.count()) {
      await callBtn.click({ timeout: 5000 });
      await expect(page.locator('#crm1DialNumber')).toHaveCount(1, { timeout: 10000 });
    }
    const createOpened = await clickIfPresent(page, /Create Order/i, { required: true, role: 'AGENT' });
    expect(createOpened, 'Agent Create Order page is missing').toBeTruthy();
    await expect(page.locator('#createOrderPage')).toBeVisible();
    await expect(page.locator('#pageMobile')).toHaveCount(1);
    await expect(page.locator('#pageProduct')).toHaveCount(1);
    await expect(page.locator('#pageQty')).toHaveCount(1);
    await expect(page.locator('#pageAmount')).toHaveCount(1);
    const callConsole = page.locator('#crm1CallConsole');
    await expect(callConsole).toBeVisible({ timeout: 10000 });
    await expect(callConsole.locator('#crm1StartCall')).toHaveCount(1);
    await expect(callConsole.locator('#crm1EndCall')).toHaveCount(1);
    await expect(callConsole.locator('#crm1LogCall')).toHaveCount(1);
    await expect(callConsole.locator('#crm1StartCall')).toBeVisible();
    await expect(callConsole.locator('#crm1EndCall')).toBeVisible();
    await expect(callConsole.locator('#crm1LogCall')).toBeVisible();
    await expect(page.locator('#pageMobile')).toHaveAttribute('required', '');
    await expect(page.locator('#pageProduct')).toHaveAttribute('required', '');
    await expect(page.locator('#pageQty')).toHaveAttribute('required', '');
    const dispositionText = await page.locator('#createOrderPage').innerText();
    expect(dispositionText).toMatch(/Disposition|Follow-up|Call|Order/i);
    assertNoRuntimeErrors(errors, 'AGENT workflow');
  });

  test('Super Admin/Manager: core operations pages are reachable', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const key of ['SUPER_ADMIN', 'MANAGER']) {
      errors.length = 0;
      await login(page, key);
      const labels = [
        /Lead Management|Lead \/ Enquiry Manager/i,
        /Lead Assignment/i, /Order Assignment/i, /Verification Queue/i,
        /PIN Auto Assignment/i, /Inventory/i, /Settlements/i, /Reports/i, /Customer 360/i
      ];
      for (const pattern of labels) {
        const opened = await clickIfPresent(page, pattern, { role: key });
        if (!opened) continue;
        const text = (await page.locator('.page.active').innerText()).replace(/\s+/g, ' ');
        expect(text.length, `${key} ${pattern} page is blank`).toBeGreaterThan(20);
        expect(text).not.toMatch(/^Loading…?$/i);
      }
      assertNoRuntimeErrors(errors, `${key} operations`);
      await page.locator('#logout').click();
      await page.waitForTimeout(400);
    }
  });

  test('Agent: dashboard scope, order search, timeline, customer 360 and reports remain usable', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page, 'AGENT');
    await clickIfPresent(page, /Dashboard/i, { role: 'AGENT' });
    await expect(page.locator('#dashboard')).toBeVisible();
    await expect(page.locator('#dashboardOrdersTable')).toBeVisible();
    await expect(page.locator('#dashFilterFrom')).toHaveCount(1);
    await expect(page.locator('#dashFilterTo')).toHaveCount(1);
    await clickIfPresent(page, /Order Search/i, { role: 'AGENT' });
    await expect(page.locator('#ordersTable')).toBeVisible();
    await expect(page.locator('#orderSearch')).toHaveCount(1);
    await expect(page.locator('#orderSearchBtn')).toHaveCount(1);
    const timeline = await clickIfPresent(page, /Order Timeline/i, { role: 'AGENT' });
    if (timeline) await expect(page.locator('.page.active')).toContainText(/Order Timeline|Timeline/i);
    const c360 = await clickIfPresent(page, /Customer 360/i, { role: 'AGENT' });
    if (c360) { await expect(page.locator('#crm360Mobile')).toHaveCount(1); await expect(page.locator('#crm360Search')).toHaveCount(1); }
    const reports = await clickIfPresent(page, /Reports/i, { role: 'AGENT' });
    if (reports) await expect(page.locator('.page.active')).toContainText(/Reports|Performance/i);
    assertNoRuntimeErrors(errors, 'AGENT search/report workflow');
  });

  test('Dealer and Courier: assigned/unassigned order workspaces, status controls and statements are reachable', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [key, orderPattern] of [['DEALER', /Dealer Orders/i], ['COURIER', /Courier Orders/i]]) {
      errors.length = 0;
      await login(page, key);
      const opened = await clickIfPresent(page, orderPattern, { required: true, role: key });
      expect(opened, `${key} order page missing`).toBeTruthy();
      const activePage = page.locator('.page.active').first();
      await expect(activePage).toBeVisible();
      const partnerPanel = activePage.locator('[data-crm1-partner-orders="1"], #crm1PartnerOrdersFinal').first();
      await expect(partnerPanel).toBeVisible({ timeout: 15000 });
      await expect(partnerPanel.locator('table:visible').first()).toBeVisible({ timeout: 10000 });
      const text = await partnerPanel.innerText();
      expect(text).toMatch(/Customer/i); expect(text).toMatch(/Mobile/i); expect(text).toMatch(/Status/i);
      const settlements = await clickIfPresent(page, /Settlements/i, { role: key });
      if (settlements) await expect(page.locator('.page.active')).toContainText(/Settlement|No settlements found|Statement/i);
      const reports = await clickIfPresent(page, /Advanced Reports|Reports/i, { role: key });
      if (reports) await expect(page.locator('.page.active')).toContainText(/Advanced Reports|Status Performance|Product Performance|Delivery %/i, { timeout: 20000 });
      assertNoRuntimeErrors(errors, `${key} partner workflow`);
      await page.locator('#logout').click();
      await page.waitForTimeout(400);
    }
  });
});
