const { test, expect } = require('@playwright/test');

const roles = [
  ['SUPER_ADMIN', /Super Admin/i],
  ['MANAGER', /Manager|Management/i],
  ['AGENT', /Agent/i],
  ['DEALER', /Dealer/i],
  ['COURIER', /Courier/i]
];
const leadRoles = new Set(['MANAGER','AGENT']);

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
  await page.waitForTimeout(2200);
}

async function clickIfPresent(page, pattern) {
  const buttons = page.locator('#nav button').filter({ hasText: pattern });
  for (let i = 0; i < await buttons.count(); i++) {
    const btn = buttons.nth(i);
    if (await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(800); return true; }
  }
  return false;
}

async function assertCorePage(page, pattern, key) {
  const opened = await clickIfPresent(page, pattern);
  expect(opened, `${key}: ${pattern} navigation is missing`).toBeTruthy();
  const text = (await page.locator('main').innerText()).replace(/\s+/g,' ').trim();
  expect(text.length, `${key}: ${pattern} page is blank`).toBeGreaterThan(20);
}

test.describe('CRM1 FINAL END-TO-END AUDIT', () => {
  test('all authenticated roles: baseline dashboard and role-specific core pages load', async ({ page }) => {
    for (const [key, expectedRole] of roles) {
      const errors=[];
      page.on('pageerror', e=>errors.push(e.message));
      await login(page,key);
      await expect(page.locator('#userInfo')).toContainText(expectedRole);
      expect((await page.locator('main').innerText()).replace(/\s+/g,' ').trim().length).toBeGreaterThan(20);
      if(key==='DEALER') {
        await assertCorePage(page,/Dealer Orders/i,key);
        await assertCorePage(page,/Settlements/i,key);
        await assertCorePage(page,/Advanced Reports/i,key);
      } else if(key==='COURIER') {
        await assertCorePage(page,/Courier Orders/i,key);
        await assertCorePage(page,/Settlements/i,key);
        await assertCorePage(page,/Advanced Reports/i,key);
      } else if(key==='AGENT') {
        await assertCorePage(page,/Create Order/i,key);
      } else if(key==='MANAGER') {
        await assertCorePage(page,/Advanced Reports/i,key);
      }
      expect(errors,`${key} page errors:\n${errors.join('\n')}`).toEqual([]);
      await page.locator('#logout').click();
      await page.waitForTimeout(400);
    }
  });

  test('Lead / Enquiry Manager is visible only to lead-capable roles and duplicate Lead Management is hidden', async ({ page }) => {
    for (const [key] of roles) {
      await login(page,key);
      const labels=await page.locator('#nav button').evaluateAll(btns=>btns.filter(b=>b.offsetParent!==null).map(b=>(b.textContent||'').replace(/\s+/g,' ').trim()));
      expect(labels.filter(x=>/^Lead Management$/i.test(x)),`${key} should not show duplicate Lead Management`).toHaveLength(0);
      const visible=labels.some(x=>/Lead \/ Enquiry Manager/i.test(x));
      expect(visible,`${key} Lead / Enquiry Manager visibility mismatch`).toBe(leadRoles.has(key));
      if(leadRoles.has(key)){
        const opened=await clickIfPresent(page,/Lead \/ Enquiry Manager/i);
        expect(opened,`${key} Lead / Enquiry Manager is not clickable`).toBeTruthy();
        await expect(page.locator('main')).toContainText(/Lead \/ Enquiry Manager|Agent Lead Work Queue/i);
      }
      await page.locator('#logout').click();
      await page.waitForTimeout(400);
    }
  });

  test('Agent: lead -> calling workspace -> create order/disposition UI is wired', async ({ page }) => {
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await login(page,'AGENT');
    expect(await clickIfPresent(page,/Lead \/ Enquiry Manager/i)).toBeTruthy();
    await expect(page.locator('main')).toContainText(/Lead \/ Enquiry Manager|Agent Lead Work Queue/i);
    const callBtn=page.locator('#crmLeadBody .crmLeadCall').first();
    if(await callBtn.count()){await callBtn.click();await page.waitForTimeout(800)}
    expect(await clickIfPresent(page,/Create Order/i)).toBeTruthy();
    await expect(page.locator('#createOrderPage')).toBeVisible();
    await expect(page.locator('#pageMobile')).toHaveCount(1);
    await expect(page.locator('#createOrderPage input[name="customer_name"]')).toHaveCount(1);
    await expect(page.locator('#pageProduct')).toHaveCount(1);
    expect(errors,errors.join('\n')).toEqual([]);
  });
});