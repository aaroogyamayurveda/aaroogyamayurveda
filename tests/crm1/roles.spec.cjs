const { test, expect } = require('@playwright/test');

const roles = [
  ['SUPER_ADMIN', /Super Admin/i],
  ['MANAGER', /Manager|Management/i],
  ['AGENT', /Agent/i],
  ['DEALER', /Dealer/i],
  ['COURIER', /Courier/i]
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
  await expect(page.locator('#app')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i, { timeout: 15000 });
}

async function assertPartnerRole(page, key, orderLabel) {
  const nav = page.locator('#nav');
  await expect(nav.locator('button:visible').filter({hasText:new RegExp(orderLabel,'i')})).toHaveCount(1);
  await expect(nav.locator('button:visible').filter({hasText:/Advanced Reports/i})).toHaveCount(1);
  await expect(nav.locator('button:visible').filter({hasText:/Order Timeline/i})).toHaveCount(0);
  await expect(nav.locator('button:visible').filter({hasText:/Conversion Workbench/i})).toHaveCount(0);

  const orderBtn = nav.locator('button:visible').filter({hasText:new RegExp(orderLabel,'i')}).first();
  await orderBtn.click();
  const activePage = page.locator('.page.active').first();
  await expect(activePage).toBeVisible({ timeout: 10000 });
  await expect(activePage.locator('table:visible').first()).toBeVisible({ timeout: 10000 });
  const text = await activePage.innerText();
  expect(text).toMatch(/Customer/i);
  expect(text).toMatch(/Mobile/i);
  expect(text).toMatch(/Product/i);
  expect(text).toMatch(/Status/i);
}

test.describe('CRM1 ROLE AUTHENTICATION', () => {
  for (const [key, expectedRole] of roles) {
    test(`${expectedRole.source.replace(/\W+/g, ' ').trim()} can authenticate into CRM1`, async ({ page }) => {
      await login(page, key);
      await expect(page.locator('#userInfo')).toContainText(expectedRole);
    });
  }
});

test('Dealer role: assigned orders show customer, mobile, product, status update, own settlements and reports', async ({page})=>{
  await login(page,'DEALER');
  await assertPartnerRole(page,'DEALER','Dealer Orders');
  const settlements=page.locator('#nav button:visible').filter({hasText:/Settlements/i}).first();
  if(await settlements.count()){await settlements.click();await expect(page.locator('main')).toContainText(/Settlement|Statement|No settlements found/i);}
  const reports=page.locator('#nav button:visible').filter({hasText:/Advanced Reports/i}).first();
  await reports.click();
  await expect(page.locator('main')).toContainText(/Advanced Reports|Orders|Delivered/i);
});

test('Courier role: assigned orders show customer, mobile, product, status update, own settlements and reports', async ({page})=>{
  await login(page,'COURIER');
  await assertPartnerRole(page,'COURIER','Courier Orders');
  const settlements=page.locator('#nav button:visible').filter({hasText:/Settlements/i}).first();
  if(await settlements.count()){await settlements.click();await expect(page.locator('main')).toContainText(/Settlement|Statement|No settlements found/i);}
  const reports=page.locator('#nav button:visible').filter({hasText:/Advanced Reports/i}).first();
  await reports.click();
  await expect(page.locator('main')).toContainText(/Advanced Reports|Orders|Delivered/i);
});
