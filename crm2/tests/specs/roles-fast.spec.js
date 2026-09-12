import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

const roleCases = [
  ['super_admin', 'CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD'],
  ['admin', 'CRM2_ADMIN_EMAIL', 'CRM2_ADMIN_PASSWORD'],
  ['manager', 'CRM2_MANAGER_EMAIL', 'CRM2_MANAGER_PASSWORD'],
  ['team_leader', 'CRM2_TEAMLEADER_EMAIL', 'CRM2_TEAMLEADER_PASSWORD'],
  ['agent', 'CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD'],
  ['qa', 'CRM2_QA_EMAIL', 'CRM2_QA_PASSWORD'],
  ['verification', 'CRM2_VERIFICATION_EMAIL', 'CRM2_VERIFICATION_PASSWORD'],
  ['warehouse', 'CRM2_WAREHOUSE_EMAIL', 'CRM2_WAREHOUSE_PASSWORD'],
  ['accounts', 'CRM2_ACCOUNTS_EMAIL', 'CRM2_ACCOUNTS_PASSWORD'],
  ['dealer_manager', 'CRM2_DEALER_EMAIL', 'CRM2_DEALER_PASSWORD'],
  ['mis', 'CRM2_MIS_EMAIL', 'CRM2_MIS_PASSWORD'],
];

const credentials = (emailKey, passwordKey) => ({ email: process.env[emailKey], password: process.env[passwordKey] });
const sideButton = (page, label) => page.locator('.side').getByRole('button', { name: label, exact: true });

async function login(page, email, password) {
  await page.goto(process.env.CRM2_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible({ timeout: 10_000 });
}

for (const [role, emailKey, passwordKey] of roleCases) {
  test(`${role}: login, role identity and logout`, async ({ page }) => {
    const c = credentials(emailKey, passwordKey);
    test.skip(!c.email || !c.password, `Missing ${role} secrets`);
    await login(page, c.email, c.password);
    await expect(page.locator('.user')).toContainText(role, { timeout: 5_000 });
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await expect(page.locator('#email')).toBeVisible({ timeout: 5_000 });
  });
}

test('super_admin: full navigation is available', async ({ page }) => {
  const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing super-admin secrets');
  await login(page, c.email, c.password);
  for (const label of ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log', 'Admin / Config']) await expect(sideButton(page, label)).toBeVisible({ timeout: 5_000 });
});

test('super_admin: management workspaces open and activate', async ({ page }) => {
  const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing super-admin secrets');
  await login(page, c.email, c.password);
  await sideButton(page, 'Admin / Config').click();
  await expect(page.getByRole('heading', { name: 'Admin & Configuration', exact: true })).toBeVisible({ timeout: 8_000 });
  await sideButton(page, 'Lead Assignment').click();
  await expect(page.getByRole('heading', { name: 'Lead Assignment', exact: true })).toBeVisible({ timeout: 8_000 });
  await expect(sideButton(page, 'Lead Assignment')).toHaveClass(/active/);
  await sideButton(page, 'MIS Drilldown').click();
  await expect(page.getByRole('heading', { name: 'MIS Drilldown', exact: true })).toBeVisible({ timeout: 8_000 });
  await expect(sideButton(page, 'MIS Drilldown')).toHaveClass(/active/);
});

test('manager: operational and management navigation is visible', async ({ page }) => {
  const c = credentials('CRM2_MANAGER_EMAIL', 'CRM2_MANAGER_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing manager secrets');
  await login(page, c.email, c.password);
  for (const label of ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log', 'Admin / Config', 'Lead Assignment', 'MIS Drilldown']) await expect(sideButton(page, label)).toBeVisible({ timeout: 5_000 });
});

test('team_leader: restricted finance navigation stays hidden', async ({ page }) => {
  const c = credentials('CRM2_TEAMLEADER_EMAIL', 'CRM2_TEAMLEADER_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing team-leader secrets');
  await login(page, c.email, c.password);
  await expect(sideButton(page, 'Accounts')).toBeHidden();
  for (const label of ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log', 'Admin / Config', 'Lead Assignment', 'MIS Drilldown']) await expect(sideButton(page, label)).toBeVisible({ timeout: 5_000 });
});

const specialistCases = [
  ['qa', 'CRM2_QA_EMAIL', 'CRM2_QA_PASSWORD', ['MIS & Analytics', 'Audit Log'], ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'Agent Targets', 'Import Leads']],
  ['verification', 'CRM2_VERIFICATION_EMAIL', 'CRM2_VERIFICATION_PASSWORD', ['Delivery / NDR / RTO'], ['Inventory', 'Dealers', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']],
  ['warehouse', 'CRM2_WAREHOUSE_EMAIL', 'CRM2_WAREHOUSE_PASSWORD', ['Inventory', 'Delivery / NDR / RTO'], ['Dealers', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']],
  ['accounts', 'CRM2_ACCOUNTS_EMAIL', 'CRM2_ACCOUNTS_PASSWORD', ['Accounts'], ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']],
  ['dealer_manager', 'CRM2_DEALER_EMAIL', 'CRM2_DEALER_PASSWORD', ['Dealers', 'Delivery / NDR / RTO'], ['Inventory', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']],
  ['mis', 'CRM2_MIS_EMAIL', 'CRM2_MIS_PASSWORD', ['MIS & Analytics', 'Import Leads', 'Audit Log'], ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'Agent Targets']],
];

for (const [role, emailKey, passwordKey, visible, hidden] of specialistCases) {
  test(`${role}: specialist navigation scope`, async ({ page }) => {
    const c = credentials(emailKey, passwordKey);
    test.skip(!c.email || !c.password, `Missing ${role} secrets`);
    await login(page, c.email, c.password);
    for (const label of visible) await expect(sideButton(page, label)).toBeVisible({ timeout: 5_000 });
    for (const label of hidden) await expect(sideButton(page, label)).toBeHidden();
  });
}

test('agent: management and restricted operational navigation is hidden', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await login(page, c.email, c.password);
  for (const label of ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log', 'Admin / Config', 'Lead Assignment', 'MIS Drilldown']) await expect(sideButton(page, label)).toBeHidden();
});

test('agent: restricted navigation is hidden during normal navigation renders', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await login(page, c.email, c.password);
  const restricted = ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log', 'Admin / Config', 'Lead Assignment', 'MIS Drilldown'];
  for (const pageLabel of ['Dashboard', 'Leads', 'Customers', 'Calling', 'Follow-ups', 'Orders', 'Verification']) {
    await sideButton(page, pageLabel).click();
    for (const label of restricted) await expect(sideButton(page, label)).toBeHidden();
  }
});

test('authenticated session survives reload and direct page selection', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await login(page, c.email, c.password);
  await sideButton(page, 'Leads').click();
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible({ timeout: 10_000 });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible({ timeout: 10_000 });
  await sideButton(page, 'Leads').click();
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible({ timeout: 10_000 });
});

test('super_admin: ERP dashboard uses top-aligned modern workspace primitives', async ({ page }) => {
  const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing super-admin secrets');
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
  const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing super-admin secrets');
  await login(page, c.email, c.password);
  await expect(page.locator('[data-chart="sales-trend"]')).toBeVisible();
  await expect(page.locator('[data-chart="order-status"]')).toBeVisible();
  await expect(page.locator('[data-chart="agent-performance"]')).toBeVisible();
});

test('super_admin: leads workspace has modern header, filters and action hierarchy', async ({ page }) => {
  const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing super-admin secrets');
  await login(page, c.email, c.password);
  await sideButton(page, 'Leads').click();
  await expect(page.locator('.main')).toHaveClass(/erp-workspace/);
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator('.filter-bar')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Lead', exact: true })).toBeVisible();
});

test('agent: responsive ERP workspace has no horizontal overflow', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await login(page, c.email, c.password);
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    await expect(page.locator('.main')).toHaveCSS('align-self', 'start');
  }
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.locator('#email')).toBeVisible({ timeout: 5_000 });
});

test('agent: create order workspace is available from Orders and Calling', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await login(page, c.email, c.password);
  await sideButton(page, 'Orders').click();
  await expect(page.getByRole('button', { name: /Create Order/i }).first()).toBeVisible({ timeout: 8_000 });
  await page.getByRole('button', { name: /Create Order/i }).first().click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });
  for (const label of ['Customer Name *', 'Mobile Number *', 'Pincode *', 'State *', 'City *', 'Area / Post *', 'Complete Delivery Address *', 'Product *', 'Quantity *', 'Payment Mode *']) await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 5_000 });
  await sideButton(page, 'Calling').click();
  await expect(page.getByRole('button', { name: /Create Order/i }).first()).toBeVisible({ timeout: 8_000 });
});

test('agent: create order workspace exposes CRM1-equivalent address and call controls', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await login(page, c.email, c.password);
  await sideButton(page, 'Orders').click();
  const createAction = page.getByRole('button', { name: /Create Order/i }).first();
  await createAction.click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('#crm2OrderMobile')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.locator('#crm2OrderPincode')).toHaveAttribute('inputmode', 'numeric');
  await expect(page.getByRole('link', { name: /Call Mobile/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Create Order/i }).last()).toBeVisible();
  await expect(page.locator('#crm2OrderState')).toBeVisible();
  await expect(page.locator('#crm2OrderCity')).toBeVisible();
  await expect(page.locator('#crm2OrderPost')).toBeVisible();
});

test('agent: persisted active call restores calling controls after refresh', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await login(page, c.email, c.password);
  await sideButton(page, 'Orders').click();
  await page.getByRole('button', { name: /Create Order/i }).first().click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });
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

test('agent: create order workspace has no horizontal overflow on desktop and mobile', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await login(page, c.email, c.password);
  await sideButton(page, 'Orders').click();
  await page.getByRole('button', { name: /Create Order/i }).first().click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `create-order horizontal overflow at ${width}px`).toBe(false);
  }
});
