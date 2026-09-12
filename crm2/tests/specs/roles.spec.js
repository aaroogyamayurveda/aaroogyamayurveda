import { test, expect } from '@playwright/test';

const credentials = (emailKey, passwordKey) => ({
  email: process.env[emailKey],
  password: process.env[passwordKey],
});

async function login(page, email, password) {
  await page.goto(process.env.CRM2_BASE_URL);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText(/Aaroogyam CRM2/)).toBeVisible();
}

const visible = async (page, labels) => {
  for (const label of labels) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
};
const hidden = async (page, labels) => {
  for (const label of labels) await expect(page.getByRole('button', { name: label, exact: true })).toBeHidden();
};

const restrictedOps = ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log', 'Admin / Config', 'Lead Assignment', 'MIS Drilldown'];

test.describe('CRM2 role access', () => {
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

  for (const [role, emailKey, passwordKey] of roles) {
    test(`${role}: login, role identity and logout`, async ({ page }) => {
      const c = credentials(emailKey, passwordKey);
      test.skip(!c.email || !c.password, `Missing ${role} secrets`);
      await login(page, c.email, c.password);
      await expect(page.locator('.user')).toContainText(role);
      await page.getByRole('button', { name: 'Logout', exact: true }).click();
      await expect(page.locator('#email')).toBeVisible();
    });
  }

  test('super_admin: full navigation is available', async ({ page }) => {
    const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
    test.skip(!c.email || !c.password, 'Missing super-admin secrets');
    await login(page, c.email, c.password);
    await visible(page, ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log', 'Admin / Config']);
  });

  test('super_admin: management nav opens and marks workspace active', async ({ page }) => {
    const c = credentials('CRM2_SUPERADMIN_EMAIL', 'CRM2_SUPERADMIN_PASSWORD');
    test.skip(!c.email || !c.password, 'Missing super-admin secrets');
    await login(page, c.email, c.password);
    await page.getByRole('button', { name: 'Admin / Config', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Admin & Configuration', exact: true })).toBeVisible({ timeout: 8000 });
    const main = page.locator('#main');
    await main.getByRole('button', { name: 'Lead Assignment', exact: true }).click();
    await expect(main.getByRole('heading', { name: 'Lead Assignment', exact: true })).toBeVisible({ timeout: 8000 });
    await expect(main.getByRole('button', { name: 'Lead Assignment', exact: true })).toHaveClass(/active/);
    await main.getByRole('button', { name: 'MIS Drilldown', exact: true }).click();
    await expect(main.getByRole('heading', { name: 'MIS Drilldown', exact: true })).toBeVisible({ timeout: 8000 });
    await expect(main.getByRole('button', { name: 'MIS Drilldown', exact: true })).toHaveClass(/active/);
  });

  test('manager: operational and management navigation is visible', async ({ page }) => {
    const c = credentials('CRM2_MANAGER_EMAIL', 'CRM2_MANAGER_PASSWORD');
    test.skip(!c.email || !c.password, 'Missing manager secrets');
    await login(page, c.email, c.password);
    await visible(page, restrictedOps);
  });

  test('team_leader: restricted finance navigation stays hidden', async ({ page }) => {
    const c = credentials('CRM2_TEAMLEADER_EMAIL', 'CRM2_TEAMLEADER_PASSWORD');
    test.skip(!c.email || !c.password, 'Missing team-leader secrets');
    await login(page, c.email, c.password);
    await expect(page.getByRole('button', { name: 'Accounts', exact: true })).toBeHidden();
    await visible(page, restrictedOps.filter(x => x !== 'Accounts'));
  });

  test('specialist roles: navigation matches operational scope', async ({ page }) => {
    const cases = [
      ['CRM2_QA_EMAIL', 'CRM2_QA_PASSWORD', ['MIS & Analytics', 'Audit Log'], ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'Agent Targets', 'Import Leads']],
      ['CRM2_VERIFICATION_EMAIL', 'CRM2_VERIFICATION_PASSWORD', ['Delivery / NDR / RTO'], ['Inventory', 'Dealers', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']],
      ['CRM2_WAREHOUSE_EMAIL', 'CRM2_WAREHOUSE_PASSWORD', ['Inventory', 'Delivery / NDR / RTO'], ['Dealers', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']],
      ['CRM2_ACCOUNTS_EMAIL', 'CRM2_ACCOUNTS_PASSWORD', ['Accounts'], ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']],
      ['CRM2_DEALER_EMAIL', 'CRM2_DEALER_PASSWORD', ['Dealers', 'Delivery / NDR / RTO'], ['Inventory', 'Accounts', 'MIS & Analytics', 'Agent Targets', 'Import Leads', 'Audit Log']],
      ['CRM2_MIS_EMAIL', 'CRM2_MIS_PASSWORD', ['MIS & Analytics', 'Import Leads', 'Audit Log'], ['Inventory', 'Dealers', 'Delivery / NDR / RTO', 'Accounts', 'Agent Targets']],
    ];
    for (const [emailKey, passwordKey, allowed, denied] of cases) {
      const c = credentials(emailKey, passwordKey);
      if (!c.email || !c.password) continue;
      await login(page, c.email, c.password);
      await visible(page, allowed);
      await hidden(page, denied);
      await page.getByRole('button', { name: 'Logout', exact: true }).click();
    }
  });

  test('agent: management-only navigation is hidden', async ({ page }) => {
    const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
    test.skip(!c.email || !c.password, 'Missing agent secrets');
    await login(page, c.email, c.password);
    await hidden(page, ['Admin / Config', 'Lead Assignment', 'MIS Drilldown']);
  });

  test('agent: all restricted operational navigation and management controls are hidden', async ({ page }) => {
    const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
    test.skip(!c.email || !c.password, 'Missing agent secrets');
    await login(page, c.email, c.password);
    await hidden(page, restrictedOps);
  });

  test('agent: restricted navigation stays hidden during normal navigation', async ({ page }) => {
    const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
    test.skip(!c.email || !c.password, 'Missing agent secrets');
    await login(page, c.email, c.password);
    for (const pageLabel of ['Dashboard', 'Leads', 'Customers', 'Calling', 'Follow-ups', 'Orders', 'Verification']) {
      await page.getByRole('button', { name: pageLabel, exact: true }).click();
      await hidden(page, restrictedOps);
    }
  });

  test('authenticated session survives navigation and reload', async ({ page }) => {
    const c = credentials('CRM2_AGENT_EMAIL', 'CRM2_AGENT_PASSWORD');
    test.skip(!c.email || !c.password, 'Missing agent secrets');
    await login(page, c.email, c.password);
    await page.getByRole('button', { name: 'Leads', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible({ timeout: 8000 });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Leads', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible({ timeout: 8000 });
  });
});
