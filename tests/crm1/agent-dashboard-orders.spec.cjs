const { test, expect } = require('@playwright/test');

async function loginAgent(page) {
  const email = process.env.CRM1_AGENT_EMAIL;
  const password = process.env.CRM1_AGENT_PASSWORD;
  expect(email).toBeTruthy();
  expect(password).toBeTruthy();
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
    throw new Error(`Agent login did not open CRM1 app. LoginMessage=${msg || '(empty)'}; URL=${page.url()}`);
  }
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i, { timeout: 10000 });
}

async function assertOnlyLoggedInAgentRows(page) {
  const userInfo = (await page.locator('#userInfo').innerText()).trim();
  const agentName = userInfo.split(/\s*•\s*/)[0].trim();
  await expect.poll(async () => {
    const rows = page.locator('#dashboardOrdersBody tr');
    const count = await rows.count();
    const foreign = [];
    for (let i = 0; i < count; i++) {
      const cells = rows.nth(i).locator('td');
      if (await cells.count() < 8) continue;
      const rowAgent = (await cells.nth(4).innerText()).trim();
      if (rowAgent && rowAgent !== agentName) foreign.push(rowAgent);
    }
    return foreign;
  }, { timeout: 10000, intervals: [100, 250, 500, 1000] }).toEqual([]);
}

async function openDashboard(page) {
  const dashboardBtn = page.locator('#nav button:visible').filter({ hasText: /Dashboard/i }).first();
  await expect(dashboardBtn).toBeVisible({ timeout: 10000 });
  await dashboardBtn.click();
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#dashboardOrdersTable')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#dashFilterType')).toBeVisible({ timeout: 10000 });
  return dashboardBtn;
}

test('Agent dashboard Your Orders stays scoped to logged-in agent on initial load and month filter', async ({ page }) => {
  await loginAgent(page);

  const dashboardBtn = await openDashboard(page);
  await assertOnlyLoggedInAgentRows(page);

  const month = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  await page.locator('#dashFilterType').selectOption('month');
  await page.locator('#dashFilterFrom').fill(month);
  await page.locator('#dashFilterTo').fill(month);
  await page.locator('#dashFilterTo').dispatchEvent('change');
  await expect(page.locator('#dashboardOrdersTable')).toBeVisible({ timeout: 10000 });
  await assertOnlyLoggedInAgentRows(page);

  await expect(page.locator('#sOrdersLabel')).toContainText(month);

  await dashboardBtn.click();
  await expect(page.locator('#dashboard')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#dashboardOrdersTable')).toBeVisible({ timeout: 10000 });
  await assertOnlyLoggedInAgentRows(page);
});

// Dedicated regression: this test must pass without relying on reopening Dashboard.
