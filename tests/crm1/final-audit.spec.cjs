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
  await expect(page.locator('#app')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#userInfo')).not.toHaveText(/^(|undefined|null)$/i);
  await page.waitForTimeout(2500);
}

function navButtons(page) {
  return page.locator('#nav .crm1-nav-group-body > button');
}

async function clickIfPresent(page, pattern) {
  const buttons = page.locator('#nav button').filter({ hasText: pattern });
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    if (!await btn.isVisible().catch(() => false)) continue;
    await btn.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

async function assertNoRuntimeErrors(errors, label) {
  expect(errors, `${label} page errors:\n${errors.join('\n')}`).toEqual([]);
}

test.describe('CRM1 FINAL END-TO-END AUDIT', () => {
  test('all authenticated roles: every visible CRM page opens with real content', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [key, expectedRole] of roles) {
      errors.length = 0;
      await login(page, key);
      await expect(page.locator('#userInfo')).toContainText(expectedRole);
      const buttons = await navButtons(page).all();
      expect(buttons.length, `${key} has no navigation pages`).toBeGreaterThan(0);
      for (let i = 0; i < buttons.length; i++) {
        const label = (await buttons[i].innerText()).replace(/\s+/g, ' ').trim();
        if (!label) continue;
        await buttons[i].click();
        await page.waitForTimeout(900);
        const mainText = (await page.locator('main').innerText()).replace(/\s+/g, ' ').trim();
        expect(mainText.length, `${key} page "${label}" is blank`).toBeGreaterThan(20);
        expect(mainText).not.toMatch(/^Loading…?$/i);
      }
      assertNoRuntimeErrors(errors, key);
      await page.locator('#logout').click();
      await page.waitForTimeout(400);
    }
  });

  test('all authenticated roles: Lead Management is hidden and Lead / Enquiry Manager is the single lead workspace', async ({ page }) => {
    for (const [key] of roles) {
      await login(page, key);
      const visibleNavLabels = await page.locator('#nav button').evaluateAll(btns => btns.filter(b => b.offsetParent !== null).map(b => (b.textContent || '').replace(/\s+/g, ' ').trim()));
      expect(visibleNavLabels.filter(x => /^Lead Management$/i.test(x)), `${key} should not show duplicate Lead Management`).toHaveLength(0);
      expect(visibleNavLabels.filter(x => /Lead \/ Enquiry Manager/i.test(x)).length, `${key} should show Lead / Enquiry Manager`).toBeGreaterThan(0);
      const leadEnquiry = page.locator('#nav button').filter({ hasText: /Lead \/ Enquiry Manager/i });
      let clicked = false;
      for (let i = 0; i < await leadEnquiry.count(); i++) {
        if (await leadEnquiry.nth(i).isVisible().catch(() => false)) { await leadEnquiry.nth(i).click(); clicked = true; break; }
      }
      expect(clicked, `${key} Lead / Enquiry Manager is not clickable`).toBeTruthy();
      await page.waitForTimeout(800);
      await expect(page.locator('main')).toContainText(/Lead \/ Enquiry Manager|Agent Lead Work Queue/i);
      await page.locator('#logout').click();
      await page.waitForTimeout(400);
    }
  });

  test('Agent: lead -> calling workspace -> create order/disposition UI is wired', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await login(page, 'AGENT');

    const leadOpened = await clickIfPresent(page, /Lead \/ Enquiry Manager/i);
    expect(leadOpened, 'Agent Lead / Enquiry Manager page is missing').toBeTruthy();
    await expect(page.locator('main')).toContainText(/Lead \/ Enquiry Manager|Agent Lead Work Queue/i);

    const callBtn = page.locator('#crmLeadBody .crmLeadCall').first();
    if (await callBtn.count()) {
      await callBtn.click();
      await page.waitForTimeout(800);
      await expect(page.locator('#createOrderPage')).toHaveClass(/active/);
    }

    const createOpened = await clickIfPresent(page, /Create Order/i);
    expect(createOpened, 'Agent Create Order page is missing').toBeTruthy();
    await expect(page.locator('#createOrderPage')).toBeVisible();
    await expect(page.locator('#pageMobile')).toHaveCount(1);
    await expect(page.locator('#pageCustomerName')).toHaveCount(1);
    await expect(page.locator('#pageProduct')).toHaveCount(1);

    assertNoRuntimeErrors(errors, 'AGENT');
  });
});