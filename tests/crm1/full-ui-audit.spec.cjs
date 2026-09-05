const { test, expect } = require('@playwright/test');

const roles = ['SUPER_ADMIN', 'MANAGER', 'AGENT', 'DEALER', 'COURIER'];
const safeButtonPattern = /^(Search|Refresh|Today|Clear|Back|Close|Open|View|Details|Apply|Reset|Next|Previous|Prev|First|Last|Filter|Show|Hide|Expand|Collapse|Edit|Cancel|Load|Retry|Dashboard|Reports)$/i;

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

async function assertPageReady(page, role, label) {
  const main = page.locator('main');
  await expect(main).toBeVisible();
  const text = (await main.innerText()).replace(/\s+/g, ' ').trim();
  expect(text.length, `${role}: ${label} rendered blank`).toBeGreaterThan(20);
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

async function exerciseSearches(page) {
  const inputs = page.locator('main input');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    if (!(await input.isVisible().catch(() => false))) continue;
    const type = (await input.getAttribute('type')) || 'text';
    if (['hidden', 'date', 'datetime-local', 'number', 'password'].includes(type)) continue;
    const id = (await input.getAttribute('id')) || '';
    const placeholder = (await input.getAttribute('placeholder')) || '';
    const name = (await input.getAttribute('name')) || '';
    const hint = `${id} ${placeholder} ${name}`;
    if (/mobile|phone|order.?search/i.test(hint)) await input.fill('9999999999');
    else if (/search/i.test(hint)) await input.fill('test');
  }
  const buttons = page.locator('main button:visible');
  const bc = await buttons.count();
  for (let i = 0; i < bc; i++) {
    const b = buttons.nth(i);
    const label = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (/^(Search|Refresh|Apply|Filter)$/i.test(label)) {
      await b.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }
}

async function auditForms(page) {
  const forms = page.locator('main form:visible');
  const fc = await forms.count();
  for (let i = 0; i < fc; i++) {
    const form = forms.nth(i);
    await expect(form).toBeVisible();
    const required = form.locator('[required]');
    const rc = await required.count();
    for (let j = 0; j < rc; j++) {
      await expect(required.nth(j)).toHaveAttribute('required', '');
    }
  }
}

async function auditVisibleButtons(page, role, label) {
  const buttons = page.locator('main button:visible');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    if (page.isClosed()) return;
    const b = buttons.nth(i);
    const text = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const aria = (await b.getAttribute('aria-label').catch(() => '')) || '';
    const id = (await b.getAttribute('id').catch(() => '')) || '';
    const signature = `${text} ${aria} ${id}`;
    if (/logout|delete|save|submit|create|assign|verify|deliver|cancel order|start call|end call|log call|update status|generate settlement/i.test(signature)) continue;
    if (safeButtonPattern.test(text) || /open|view|details|search|refresh|filter|apply|clear|close/i.test(signature)) {
      await b.click().catch(() => {});
      await page.waitForTimeout(250);
    }
  }
}

test.describe('CRM1 FULL UI AUDIT', () => {
  for (const role of roles) {
    test(`${role}: all visible navigation pages, forms, searches and safe buttons`, async ({ page }) => {
      const errors = [];
      const failedResponses = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('response', r => {
        if (r.status() >= 500 && !/favicon|analytics/i.test(r.url())) failedResponses.push(`${r.status()} ${r.url()}`);
      });

      await login(page, role);
      await assertNoDuplicateIds(page, role, 'dashboard');

      const navButtons = page.locator('#nav button:visible');
      const navCount = await navButtons.count();
      expect(navCount, `${role}: no visible navigation buttons`).toBeGreaterThan(0);

      const labels = [];
      for (let i = 0; i < navCount; i++) {
        const label = (await navButtons.nth(i).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        if (label) labels.push(label);
      }

      for (const label of [...new Set(labels)]) {
        const btn = page.locator('#nav button:visible').filter({ hasText: label }).first();
        if (!(await btn.count())) continue;
        await btn.click();
        await page.waitForTimeout(700);
        await assertPageReady(page, role, label);
        await assertNoDuplicateIds(page, role, label);
        await auditForms(page);
        await exerciseSearches(page);
        await auditVisibleButtons(page, role, label);
        await page.waitForTimeout(300);
      }

      expect(failedResponses, `${role}: server 5xx responses:\n${failedResponses.join('\n')}`).toEqual([]);
      expect(errors, `${role}: runtime errors:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});
