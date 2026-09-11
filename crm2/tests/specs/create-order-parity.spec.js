import { test, expect } from '@playwright/test';

const credentials = () => ({
  email: process.env.CRM2_AGENT_EMAIL,
  password: process.env.CRM2_AGENT_PASSWORD,
});

async function login(page) {
  const c = credentials();
  test.skip(!c.email || !c.password, 'Missing agent secrets');
  await page.goto(process.env.CRM2_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.locator('#email').fill(c.email);
  await page.locator('#password').fill(c.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible({ timeout: 10_000 });
}

test('agent: CRM1-style Create Order page has final section layout', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.getByRole('button', { name: /Create Order/i }).first().click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });

  await expect(page.getByRole('heading', { name: 'Manual Phone Call Console', exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Telephony', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customer Details', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order Details', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Remarks', exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Disposition & Follow-up', exact: true })).toBeVisible();
  await expect(page.getByText('Disposition Level 1 *', { exact: true })).toBeVisible();
  await expect(page.getByText('Disposition Level 2 *', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Disposition', exact: true })).toBeVisible();
  await expect(page.getByText('Order Summary', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save & Follow-up', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Fast Order', exact: true })).toHaveCount(0);
});

test('agent: Create Order product selector has requested ₹1999 products', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.getByRole('button', { name: /Create Order/i }).first().click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });
  const product = page.locator('#crm2OrderProduct');
  await expect(product).toContainText('Ortho Gold');
  await expect(product).toContainText('Nasha Naasham');
  const options = await product.locator('option').evaluateAll(opts => opts.map(o => ({ text: o.textContent || '', price: o.dataset.price || '' })));
  expect(options.some(o => /Ortho Gold/i.test(o.text) && Number(o.price) === 1999)).toBe(true);
  expect(options.some(o => /Nasha Naasham/i.test(o.text) && Number(o.price) === 1999)).toBe(true);
});

test('agent: Create Order remains responsive without horizontal overflow', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page.getByRole('button', { name: /Create Order/i }).first().click();
  await expect(page.locator('[data-crm2-create-order]')).toBeVisible({ timeout: 8_000 });
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }
});
