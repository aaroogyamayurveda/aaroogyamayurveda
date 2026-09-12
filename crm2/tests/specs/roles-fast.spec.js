import { test, expect } from '@playwright/test';
const credentials=(emailKey,passwordKey)=>({email:process.env[emailKey],password:process.env[passwordKey]});
async function login(page,email,password){await page.goto(process.env.CRM2_BASE_URL,{waitUntil:'domcontentloaded',timeout:15_000});await page.locator('#email').fill(email);await page.locator('#password').fill(password);await page.getByRole('button',{name:'Login',exact:true}).click();await expect(page.getByRole('button',{name:'Logout',exact:true})).toBeVisible({timeout:10_000})}
const sideButton=(page,name)=>page.getByRole('button',{name,exact:true});

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
  await page.getByRole('button', { name: /Create Order/i }).first().click();
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
