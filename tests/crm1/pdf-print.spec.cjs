const { test, expect } = require('@playwright/test');

async function login(page, key) {
  const email = process.env[`CRM1_${key}_EMAIL`];
  const password = process.env[`CRM1_${key}_PASSWORD`];
  expect(email, `Missing CRM1_${key}_EMAIL secret`).toBeTruthy();
  expect(password, `Missing CRM1_${key}_PASSWORD secret`).toBeTruthy();
  await page.goto('/crm1/', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i);
  await page.waitForTimeout(2000);
}

for (const [key, orderLabel] of [['DEALER','Dealer Orders'], ['COURIER','Courier Orders']]) {
  test(`${orderLabel}: Print Order button is present after Update and generates Order PDF`, async ({ page }) => {
    await login(page, key);
    const nav = page.locator('#nav');
    await nav.locator('button').filter({ hasText: new RegExp(orderLabel, 'i') }).first().click();
    await expect(page.locator('main')).toContainText(orderLabel);

    const table = page.locator('main .page.active table#crm1PartnerFinalTable');
    await expect(table).toBeVisible({ timeout: 10000 });
    const headers = await table.locator('thead').innerText();
    expect(headers).toMatch(/Update/i);
    expect(headers).toMatch(/Print Order/i);

    const row = table.locator('tbody tr[data-order-id]').first();
    await expect(row).toBeVisible({ timeout: 10000 });
    const printButton = row.locator('button.crm1PartnerPrint');
    await expect(printButton).toHaveText(/Print Order/i);

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await printButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^Order-.+\.pdf$/i);
  });
}
