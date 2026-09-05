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

async function clickIfPresent(page, pattern) {
  await expandNavigation(page);
  const candidates = page.locator('#nav .crm1-nav-group-body > button:visible, #nav > button:visible');
  const btn = candidates.filter({ hasText: pattern }).first();
  if (await btn.count() && await btn.isVisible().catch(() => false)) {
    await btn.click();
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
    return true;
  }
  return false;
}

async function assertNoRuntimeErrors(errors, label) {
  expect(errors, `${label} page errors:\n${errors.join('\n')}`).toEqual([]);
}

test.describe('CRM1 FINAL END-TO-END AUDIT', () => {
  test('all authenticated roles: every visible CRM page opens with real content', async ({ page }) => {
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
        const label = (await nav.nth(i).innerText()).replace(/\s+/g, ' ').trim();
        if (label) labels.push(label);
      }
      for (const label of [...new Set(labels)]) {
        await expandNavigation(page);
        const btn = page.locator('#nav .crm1-nav-group-body > button:visible, #nav > button:visible').filter({ hasText: label }).first();
        if (!(await btn.count())) continue;
        await btn.click();
        await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
        const mainText = (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim();
        expect(mainText.length, `${key} page "${label}" is blank`).toBeGreaterThan(20);
        expect(mainText).not.toMatch(/^Loading…?$/i);
      }
      assertNoRuntimeErrors(errors, key);
      await page.locator('#logout').click();
      await page.waitForTimeout(400);
    }
  });

  test('Agent: todays calling queue -> call context -> create order/disposition UI is wired', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page, 'AGENT');

    const queueOpened = await clickIfPresent(page, /Today.?s Calling Queue/i);
    expect(queueOpened, 'Agent Today\'s Calling Queue page is missing').toBeTruthy();
    await expect(page.locator('main')).toContainText(/Today.?s Calling Queue|Calling Queue/i);

    const callBtn = page.locator('#crmW2QueueBody button, #crmLeadBody .crmLeadCall').filter({ hasText: /Call|Dial/i }).first();
    if (await callBtn.count()) {
      await callBtn.click();
      await expect(page.locator('#crm1DialNumber')).toHaveCount(1, { timeout: 10000 });
    }

    const createOpened = await clickIfPresent(page, /Create Order/i);
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
    await expect(page.locator('#pageAmount')).toHaveAttribute('required', '');
    await expect(page.locator('#crm1StartCall')).toHaveCount(1);
    await expect(page.locator('#crm1EndCall')).toHaveCount(1);
    await expect(page.locator('#crm1LogCall')).toHaveCount(1);
    await expect(page.locator('#crm1StartCall')).toBeEnabled();
    await expect(page.locator('#crm1EndCall')).toBeEnabled();
    await expect(page.locator('#crm1LogCall')).toBeEnabled();
    await expect(page.locator('#crm1StartCall')).toHaveCSS('background-color', /./);
    await expect(page.locator('#crm1EndCall')).toHaveCSS('background-color', /./);
    await assertNoRuntimeErrors(errors, 'Agent calling/create-order workflow');
  });

  test('Super Admin/Manager: lead assignment, order assignment, verification, PIN and inventory pages are reachable', async ({ page }) => {
    await login(page, 'SUPER_ADMIN');
    for (const pattern of [/Lead Assignment/i, /Order Assignment/i, /Verification Queue/i, /PIN Auto Assignment/i, /Inventory/i]) {
      const opened = await clickIfPresent(page, pattern);
      expect(opened, `Missing page ${pattern}`).toBeTruthy();
      await expect(page.locator('main')).toBeVisible();
    }
    await login(page, 'MANAGER');
    for (const pattern of [/Lead Assignment/i, /Order Assignment/i, /Verification Queue/i, /PIN Auto Assignment/i, /Inventory/i]) {
      const opened = await clickIfPresent(page, pattern);
      expect(opened, `Manager missing page ${pattern}`).toBeTruthy();
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('Agent: dashboard scope, order search, timeline, customer 360 and reports remain usable', async ({ page }) => {
    await login(page, 'AGENT');
    for (const pattern of [/Dashboard/i, /Order Search/i, /Order Timeline/i, /Customer 360/i, /Advanced Reports/i]) {
      const opened = await clickIfPresent(page, pattern);
      expect(opened, `Agent missing page ${pattern}`).toBeTruthy();
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('Dealer and Courier: assigned/unassigned order workspaces, status controls and statements are reachable', async ({ page }) => {
    await login(page, 'DEALER');
    for (const pattern of [/Dealer Orders/i, /Reports/i, /Settlements/i, /Advanced Reports/i]) {
      const opened = await clickIfPresent(page, pattern);
      expect(opened, `Dealer missing page ${pattern}`).toBeTruthy();
      await expect(page.locator('main')).toBeVisible();
    }
    await login(page, 'COURIER');
    for (const pattern of [/Courier Orders/i, /Reports/i, /Settlements/i, /Advanced Reports/i]) {
      const opened = await clickIfPresent(page, pattern);
      expect(opened, `Courier missing page ${pattern}`).toBeTruthy();
      await expect(page.locator('main')).toBeVisible();
    }
  });
});
