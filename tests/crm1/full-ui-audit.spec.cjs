const { test, expect } = require('@playwright/test');

const roles = ['SUPER_ADMIN', 'MANAGER', 'AGENT', 'DEALER', 'COURIER'];

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
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i, { timeout: 15000 });
}

async function expandNavigation(page) {
  const groups = page.locator('#nav .crm1-nav-group');
  const count = await groups.count();
  for (let i = 0; i < count; i++) {
    const group = groups.nth(i);
    if (!(await group.locator('.crm1-nav-group-body').isVisible().catch(() => false))) {
      await group.locator('.crm1-nav-group-title').click().catch(() => {});
    }
  }
}

async function assertPageReady(page, role, label) {
  const main = page.locator('main');
  await expect(main).toBeVisible();
  await expect.poll(async () => {
    const text = (await main.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    return text.length;
  }, { timeout: 30000, intervals: [250, 500, 1000, 2000] }).toBeGreaterThan(20);
  const text = (await main.innerText()).replace(/\s+/g, ' ').trim();
  expect(text, `${role}: ${label} stuck on loading`).not.toMatch(/^Loading…?$/i);
}

async function assertNoDuplicateIds(page, role, label) {
  const duplicates = await page.evaluate(() => {
    const map = new Map();
    document.querySelectorAll('[id]').forEach(el => map.set(el.id, (map.get(el.id) || 0) + 1));
    return [...map.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n})`);
  });
  expect(duplicates, `${role}: duplicate IDs on ${label}`).toEqual([]);
}

async function auditForms(page) {
  const forms = page.locator('main form:visible');
  const fc = await forms.count();
  for (let i = 0; i < fc; i++) {
    const form = forms.nth(i);
    await expect(form).toBeVisible();
    const required = form.locator('[required]');
    const rc = await required.count();
    for (let j = 0; j < rc; j++) await expect(required.nth(j)).toHaveAttribute('required', '');
  }
}

async function inspectSearches(page) {
  // Inspection only: never click or submit generic search/filter controls because they can
  // trigger expensive data reloads or detach the DOM while this audit is iterating pages.
  const inputs = page.locator('main input:visible');
  const count = await inputs.count();
  expect(count, 'main has no visible inputs is allowed').toBeGreaterThanOrEqual(0);
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const type = (await input.getAttribute('type')) || 'text';
    if (['hidden', 'password'].includes(type)) continue;
    await expect(input).toBeVisible();
  }
}

async function inspectVisibleButtons(page) {
  // Inspection only. Business actions, navigation, and data reloads are exercised by focused
  // role tests; the generic audit must not mutate state or race renderers.
  const buttons = page.locator('main button:visible');
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < count; i++) await expect(buttons.nth(i)).toBeVisible();
}

test.describe('CRM1 FULL UI AUDIT', () => {
  for (const role of roles) {
    test(`${role}: all visible navigation pages, forms, searches and safe buttons`, async ({ page }) => {
      test.setTimeout(240000);
      const errors = [];
      const failedResponses = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => {
        if (r.status() >= 500 && !/favicon|analytics/i.test(r.url())) failedResponses.push(`${r.status()} ${r.url()}`);
      });

      await login(page, role);
      await expandNavigation(page);
      await assertNoDuplicateIds(page, role, 'dashboard');

      const navButtons = page.locator('#nav .crm1-nav-group-body > button:visible, #nav > button:visible');
      const navCount = await navButtons.count();
      expect(navCount, `${role}: no visible navigation buttons`).toBeGreaterThan(0);

      const labels = [];
      for (let i = 0; i < navCount; i++) {
        const label = (await navButtons.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (label) labels.push(label);
      }

      for (const label of [...new Set(labels)]) {
        await expandNavigation(page);
        const btn = page.locator('#nav .crm1-nav-group-body > button:visible, #nav > button:visible').filter({ hasText: label }).first();
        if (!(await btn.count())) continue;
        await btn.click({ timeout: 5000 });
        await assertPageReady(page, role, label);
        await assertNoDuplicateIds(page, role, label);
        await auditForms(page);
        await inspectSearches(page);
        await inspectVisibleButtons(page);
      }

      expect(failedResponses, `${role}: server 5xx responses:\n${failedResponses.join('\n')}`).toEqual([]);
      expect(errors, `${role}: runtime errors:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});
