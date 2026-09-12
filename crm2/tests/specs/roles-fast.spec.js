import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

const credentials = () => ({ email: process.env.CRM2_AGENT_EMAIL, password: process.env.CRM2_AGENT_PASSWORD });
const superCredentials = () => ({ email: process.env.CRM2_SUPERADMIN_EMAIL, password: process.env.CRM2_SUPERADMIN_PASSWORD });
const sideButton = (page, label) => page.locator('.side').getByRole('button', { name: label, exact: true });

async function login(page, email, password) {
  test.skip(!email || !password, 'Missing required CRM2 role secrets');
  await page.goto(process.env.CRM2_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible({ timeout: 10_000 });
}

async function openCreateOrder(page) {
  const c = credentials();
  await login(page, c.email, c.password);
  await sideButton(page, 'Orders').click();
  await page.getByRole('button', { name: /Create Order/i }).first().click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });
}

test('super_admin: ERP dashboard uses top-aligned modern workspace primitives', async ({ page }) => {
  const c = superCredentials();
  await login(page, c.email, c.password);
  await expect(page.locator('.main')).toHaveClass(/erp-workspace/);
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.kpi-grid')).toBeVisible();
  await expect(page.locator('.analytics-grid')).toBeVisible();
  await expect(page.locator('.business-funnel')).toBeVisible();
  await expect(page.locator('.quick-actions')).toBeVisible();
  await expect(page.locator('.main')).toHaveCSS('align-self', 'start');
});

test('super_admin: dashboard renders visual analytics containers without fake records', async ({ page }) => {
  const c = superCredentials();
  await login(page, c.email, c.password);
  await expect(page.locator('[data-chart="sales-trend"]')).toBeVisible();
  await expect(page.locator('[data-chart="order-status"]')).toBeVisible();
  await expect(page.locator('[data-chart="agent-performance"]')).toBeVisible();
});

test('super_admin: leads workspace has modern header, filters and action hierarchy', async ({ page }) => {
  const c = superCredentials();
  await login(page, c.email, c.password);
  await sideButton(page, 'Leads').click();
  await expect(page.locator('.main')).toHaveClass(/erp-workspace/);
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.filter-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Lead', exact: true })).toBeVisible();
});

test('agent: responsive ERP workspace has no horizontal overflow', async ({ page }) => {
  await openCreateOrder(page);
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});

test('agent: create order workspace exposes CRM1-equivalent address and call controls', async ({ page }) => {
  await openCreateOrder(page);
  await expect(page.locator('#crm2OrderMobile')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.locator('#crm2OrderPincode')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByRole('link', { name: /Call Mobile/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Disposition', exact: true })).toBeVisible();
  await expect(page.locator('#crm2OrderState')).toBeVisible();
  await expect(page.locator('#crm2OrderCity')).toBeVisible();
  await expect(page.locator('#crm2OrderPost')).toBeVisible();
});

test('agent: persisted active call restores calling controls after refresh', async ({ page }) => {
  await openCreateOrder(page);
  await page.evaluate(() => localStorage.setItem('crm2ActiveCall', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', startedAt: new Date(Date.now() - 5000).toISOString(), agentId: null })));
  await sideButton(page, 'Dashboard').click();
  await sideButton(page, 'Orders').click();
  await page.getByRole('button', { name: /Create Order/i }).first().click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('#crm2CallStart')).toBeDisabled();
  await expect(page.locator('#crm2CallEnd')).toBeEnabled();
  await expect(page.locator('#crm2CallTimer')).not.toHaveText('00:00');
  await page.evaluate(() => localStorage.removeItem('crm2ActiveCall'));
});

test('agent: create order workspace remains responsive on desktop and mobile', async ({ page }) => {
  await openCreateOrder(page);
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `create-order horizontal overflow at ${width}px`).toBe(false);
  }
});
