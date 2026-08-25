const { test, expect } = require('@playwright/test');

const roles = [
  ['SUPER_ADMIN','Super Admin'], ['MANAGER','Manager'], ['AGENT','Agent'], ['DEALER','Dealer'], ['COURIER','Courier']
];

async function login(page, key) {
  const email = process.env[`CRM1_${key}_EMAIL`];
  const password = process.env[`CRM1_${key}_PASSWORD`];
  expect(email, `Missing CRM1_${key}_EMAIL secret`).toBeTruthy();
  expect(password, `Missing CRM1_${key}_PASSWORD secret`).toBeTruthy();

  await page.goto('/crm1/', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#loginForm button[type="submit"]').click();

  const deadline = Date.now() + 15000;
  let loginMessage = '';
  while (Date.now() < deadline) {
    if (await page.locator('#app').isVisible().catch(() => false)) break;
    loginMessage = (await page.locator('#loginMsg').innerText().catch(() => '')).trim();
    if (loginMessage && !/Login हो रहा है/.test(loginMessage)) break;
    await page.waitForTimeout(250);
  }

  if (!(await page.locator('#app').isVisible().catch(() => false))) {
    loginMessage = (await page.locator('#loginMsg').innerText().catch(() => loginMessage)).trim();
    throw new Error(`${key} login did not open CRM1 app. LoginMessage=${loginMessage || '(empty)'}; URL=${page.url()}`);
  }

  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i);
}

for (const [key, label] of roles) {
  test(`${label} can authenticate into CRM1`, async ({ page }) => {
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await login(page, key);
    await page.waitForTimeout(1500);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('Dealer role: role navigation and orders page are reachable', async ({ page }) => {
  await login(page, 'DEALER');
  const navText = await page.locator('#nav').innerText();
  expect(navText).toMatch(/Dealer Orders/i);
  const dealerBtn = page.locator('#nav button').filter({hasText:/Dealer Orders/i}).first();
  await dealerBtn.click();
  await page.waitForTimeout(800);
  expect(await page.locator('main').innerText()).toMatch(/Dealer Orders/i);
});

test('Courier role: role navigation and orders page are reachable', async ({ page }) => {
  await login(page, 'COURIER');
  const navText = await page.locator('#nav').innerText();
  expect(navText).toMatch(/Courier Orders/i);
  const btn = page.locator('#nav button').filter({hasText:/Courier Orders/i}).first();
  await btn.click();
  await page.waitForTimeout(800);
  expect(await page.locator('main').innerText()).toMatch(/Courier Orders/i);
});
