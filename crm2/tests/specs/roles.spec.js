import { test, expect } from '@playwright/test';

const roles = [
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

function credentials(emailKey, passwordKey) {
  const email = process.env[emailKey];
  const password = process.env[passwordKey];
  return email && password ? { email, password } : null;
}

async function login(page, email, password) {
  await page.goto('./');
  const emailBox = page.locator('#email');
  if (await emailBox.isVisible().catch(() => false)) {
    await emailBox.fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
  }
  await expect(page.locator('.top')).toContainText('Aaroogyam CRM2');
}

for (const [role, emailKey, passwordKey] of roles) {
  test(`${role}: login, role identity and logout`, async ({ page }) => {
    const c = credentials(emailKey, passwordKey);
    test.skip(!c, `Missing ${emailKey}/${passwordKey} GitHub Actions secrets`);
    await login(page, c.email, c.password);
    await expect(page.locator('.user')).toContainText(role);
    await expect(page.locator('#logout')).toBeVisible();
    await page.locator('#logout').click();
    await expect(page.locator('#email')).toBeVisible();
  });
}

test('super_admin: full navigation is available', async ({ page }) => {
  const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
  test.skip(!c, 'Missing super-admin secrets');
  await login(page, c.email, c.password);
  for (const label of ['Dashboard', 'Leads', 'Customers', 'Calling', 'Follow-ups', 'Orders', 'Verification', 'Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
});

test('super_admin: management nav opens quickly and marks the selected workspace active', async ({ page }) => {
  const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
  test.skip(!c, 'Missing super-admin secrets');
  await login(page, c.email, c.password);
  const side = page.locator('.side');
  const admin = side.getByRole('button', { name: 'Admin / Config', exact: true });
  await expect(admin).toBeVisible();
  await admin.click();
  await expect(page.getByRole('heading', { name: 'Admin & Configuration', exact: true })).toBeVisible({ timeout: 3000 });
  const mis = side.getByRole('button', { name: 'MIS Drilldown', exact: true });
  const assignment = side.getByRole('button', { name: 'Lead Assignment', exact: true });
  await expect(mis).toBeVisible();
  await expect(assignment).toBeVisible();
  await mis.click();
  await expect(page.getByRole('heading', { name: 'MIS Drilldown', exact: true })).toBeVisible({ timeout: 3000 });
  await expect(mis).toHaveClass(/active/);
  await expect(assignment).not.toHaveClass(/active/);
  await assignment.click();
  await expect(page.getByRole('heading', { name: 'Lead Assignment', exact: true })).toBeVisible({ timeout: 3000 });
  await expect(assignment).toHaveClass(/active/);
  await expect(mis).not.toHaveClass(/active/);
});

test('agent: management-only navigation is hidden', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c, 'Missing agent secrets');
  await login(page, c.email, c.password);
  for (const label of ['Dealers', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeHidden();
  }
});

test('agent: all restricted operational navigation and management controls are hidden', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c, 'Missing agent secrets');
  await login(page, c.email, c.password);
  for (const label of ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log', 'Admin / Config', 'Lead Assignment', 'MIS Drilldown']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeHidden();
  }
});

test('agent: restricted navigation is already hidden during each normal navigation render', async ({ page }) => {
  const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
  test.skip(!c, 'Missing agent secrets');
  await login(page, c.email, c.password);
  for (const pageId of ['dashboard', 'leads', 'customers', 'calling', 'followups', 'orders', 'verification']) {
    await page.locator(`[data-page="${pageId}"]`).click();
    const state = await page.locator('.side').evaluate((side) => [...side.querySelectorAll('[data-page]')].map((b) => ({ page: b.dataset.page, hidden: b.hidden, display: getComputedStyle(b).display })));
    for (const item of state.filter((x) => ['inventory', 'dealers', 'delivery', 'accounts', 'reports', 'targets', 'imports', 'audit'].includes(x.page))) {
      expect(item.hidden || item.display === 'none', `${item.page} must be hidden immediately after ${pageId} navigation`).toBeTruthy();
    }
  }
});

test('authenticated session survives navigation and direct page selection', async ({ page }) => {
  const c = credentials('CRM2_MANAGER_EMAIL', 'CRM2_MANAGER_PASSWORD');
  test.skip(!c, 'Missing manager secrets');
  await login(page, c.email, c.password);
  await page.locator('[data-page="leads"]').click();
  await expect(page.locator('h2')).toContainText('Leads');
  await page.reload();
  await expect(page.locator('.top')).toContainText('Aaroogyam CRM2');
  await expect(page.locator('.user')).toContainText('manager');
});
