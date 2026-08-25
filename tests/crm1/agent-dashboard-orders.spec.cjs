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
  await expect(page.locator('#app')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i);
}

async function assertOnlyLoggedInAgentRows(page) {
  const agentName = await page.locator('#userInfo').innerText();
  const rows = page.locator('#dashboardOrdersBody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const cells = rows.nth(i).locator('td');
    if (await cells.count() < 8) continue;
    const rowAgent = (await cells.nth(4).innerText()).trim();
    expect(rowAgent, `Unexpected agent in Your Orders row ${i + 1}`).toBe(agentName.trim());
  }
}

test('Agent dashboard Your Orders stays scoped to logged-in agent on initial load and month filter', async ({ page }) => {
  await loginAgent(page);

  const dashboardBtn = page.locator('#nav button').filter({ hasText: /Dashboard/i }).first();
  await dashboardBtn.click();
  await expect(page.locator('#dashboardOrdersBody')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#dashFilterType')).toBeVisible();
  await assertOnlyLoggedInAgentRows(page);

  const month = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  await page.locator('#dashFilterType').selectOption('month');
  await page.locator('#dashFilterFrom').fill(month);
  await page.locator('#dashFilterTo').fill(month);
  await page.locator('#dashFilterTo').dispatchEvent('change');
  await page.waitForTimeout(1200);
  await assertOnlyLoggedInAgentRows(page);

  await expect(page.locator('#sOrdersLabel')).toContainText(month);

  await dashboardBtn.click();
  await expect(page.locator('#dashboardOrdersBody')).toBeVisible({ timeout: 10000 });
  await assertOnlyLoggedInAgentRows(page);
});
