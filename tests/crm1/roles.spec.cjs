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
  await page.waitForTimeout(1800);
}

async function assertPartnerRole(page, key, orderLabel) {
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await login(page, key);
  const nav = page.locator('#nav');
  await expect(nav).toContainText(orderLabel);
  await expect(nav).toContainText(/Advanced Reports/i);
  await expect(nav).not.toContainText(/Order Timeline/i);
  await expect(nav).not.toContainText(/Conversion Workbench/i);
  const orderBtn = nav.locator('button').filter({hasText:new RegExp(orderLabel,'i')}).first();
  await orderBtn.click();
  await expect(page.locator('main')).toContainText(orderLabel);
  const activeTableHead = page.locator('main .page.active table thead').first();
  await expect(activeTableHead).toContainText(/Update/i,{timeout:10000});
  const headerText = await activeTableHead.innerText();
  expect(headerText).toMatch(/Customer/i);
  expect(headerText).toMatch(/Mobile/i);
  expect(headerText).toMatch(/Product/i);
  expect(headerText).toMatch(/Status/i);
  expect(headerText).toMatch(/Update/i);
  const rows = await page.locator('main .page.active table tbody tr').count();
  expect(rows).toBeGreaterThanOrEqual(1);
  const settlementBtn = nav.locator('button').filter({hasText:/Settlements/i}).first();
  if (await settlementBtn.count()) {
    await settlementBtn.click();
    await expect(page.locator('main')).toContainText(/Your Settlements|No settlements found/i,{timeout:10000});
    await expect(page.locator('main')).not.toContainText(/Generate Settlement/i);
  }
  const reportBtn = nav.locator('button').filter({hasText:/Advanced Reports/i}).first();
  await reportBtn.click();
  await expect(page.locator('main')).toContainText(/Advanced Reports/i);
  await expect(page.locator('main')).toContainText(/Orders/i,{timeout:10000});
  await expect(page.locator('main')).toContainText(/Delivered/i);
  await page.waitForTimeout(15000);
  await expect(page.locator('main')).toContainText(/Advanced Reports/i);
  await expect(page.locator('main')).toContainText(/Orders/i);
  await expect(page.locator('main')).toContainText(/Delivered/i);
  await expect(page.locator('main')).not.toContainText(/Total Assigned/i);
  await expect(page.locator('main')).not.toContainText(/Your dealer performance and delivery report/i);
  await expect(page.locator('.crm1-stability-loading')).toHaveCount(0);
  await expect(page.locator('main')).not.toHaveText(/^\s*Loading…?\s*$/i);
  expect(errors, errors.join('\n')).toEqual([]);
}

for (const [key, label] of roles) {
  test(`${label} can authenticate into CRM1`, async ({ page }) => {
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await login(page, key);
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('Dealer role: assigned orders show customer, mobile, product, status update, own settlements and reports', async ({ page }) => {
  await assertPartnerRole(page, 'DEALER', 'Dealer Orders');
});

test('Courier role: assigned orders show customer, mobile, product, status update, own settlements and reports', async ({ page }) => {
  await assertPartnerRole(page, 'COURIER', 'Courier Orders');
});

for (const [key, label] of roles) {
  test(`${label} sees Generate Invoice after Other menu and opens invoice workspace`, async ({ page }) => {
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await login(page, key);
    const nav = page.locator('#nav');
    const groups = nav.locator('.crm1-nav-group');
    const otherIndex = await groups.evaluateAll(items => items.findIndex(x => x.dataset.group === 'other'));
    const invoiceGroup = nav.locator('.crm1-nav-group[data-group="generate-invoice"]');
    await expect(invoiceGroup).toBeVisible();
    const invoiceIndex = await groups.evaluateAll(items => items.findIndex(x => x.dataset.group === 'generate-invoice'));
    expect(otherIndex).toBeGreaterThanOrEqual(0);
    expect(invoiceIndex).toBeGreaterThan(otherIndex);
    const invoice = invoiceGroup.locator('button').filter({ hasText: /Generate Invoice/i }).first();
    await expect(invoice).toBeVisible();
    await invoice.click();
    await expect(page.locator('#crm1GenerateInvoicePage')).toBeVisible();
    await expect(page.locator('#crm1InvoiceSearch')).toBeVisible();
    await expect(page.locator('#crm1InvoiceFind')).toBeVisible();
    await expect(page.locator('#crm1InvoicePrint')).toBeVisible();
    await expect(page.locator('#crm1InvoiceExcel')).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('Generate Invoice searches an existing order and supports Print/PDF and Excel export', async ({ page }) => {
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await login(page, 'SUPER_ADMIN');
  const invoice = page.locator('#nav .crm1-nav-group[data-group="generate-invoice"] button').filter({ hasText: /Generate Invoice/i }).first();
  await invoice.click();
  await page.locator('#crm1InvoiceSearch').fill('39');
  await page.locator('#crm1InvoiceFind').click();
  await expect(page.locator('#crm1InvoiceResults')).toContainText('Order #39',{timeout:15000});
  await expect(page.locator('#crm1InvoicePrint')).toBeEnabled();
  await expect(page.locator('#crm1InvoiceExcel')).toBeEnabled();
  const popupPromise=page.waitForEvent('popup');
  await page.locator('#crm1InvoicePrint').click();
  const popup=await popupPromise;
  await popup.waitForLoadState();
  await expect(popup).toHaveTitle(/Invoice 39/i);
  await expect(popup.locator('body')).toContainText(/Order\s*\/\s*Order No|Order No|Invoice\s*\/\s*Order No/i);
  await popup.close();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#crm1InvoiceExcel').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('Generate-Invoice-Export.csv');
  expect(errors, errors.join('\n')).toEqual([]);
});

for (const [key, label] of roles) {
  test(label + ' sees Export Order Dump as the final standalone menu and opens workspace', async ({ page }) => {
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await login(page, key);
    const nav=page.locator('#nav');
    const groups=nav.locator('.crm1-nav-group');
    const dumpGroup=nav.locator('#nav .crm1-nav-group[data-group="export-order-dump"]');
    await expect(dumpGroup).toBeVisible();
    const dumpIndex=await groups.evaluateAll(items=>items.findIndex(x=>x.dataset.group==='export-order-dump'));
    const groupCount=await groups.count();
    expect(dumpIndex).toBe(groupCount-1);
    const dump=dumpGroup.locator('button').filter({hasText:/Export Order Dump/i}).first();
    await expect(dump).toBeVisible();
    await dump.click();
    await expect(page.locator('#crm1ExportOrderDumpPage')).toBeVisible();
    await expect(page.locator('#crm1OrderDumpFrom')).toBeVisible();
    await expect(page.locator('#crm1OrderDumpTo')).toBeVisible();
    await expect(page.locator('#crm1OrderDumpGenerate')).toBeVisible();
    await expect(page.locator('#crm1OrderDumpExcel')).toBeVisible();
    expect(errors, errors.join('\\n')).toEqual([]);
  });
}

test('Export Order Dump generates paginated report with Generate Invoice export columns and CSV', async ({ page }) => {
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await login(page, 'SUPER_ADMIN');
  const dump=page.locator('#nav .crm1-nav-group[data-group="export-order-dump"] button').filter({hasText:/Export Order Dump/i}).first();
  await dump.click();
  await page.locator('#crm1OrderDumpFrom').fill('2020-01-01');
  await page.locator('#crm1OrderDumpTo').fill('2099-12-31');
  await page.locator('#crm1OrderDumpGenerate').click();
  await expect(page.locator('#crm1OrderDumpResults')).toContainText(/Order Number|No orders found/i,{timeout:20000});
  const table=page.locator('#crm1OrderDumpResults table');
  if(await table.count()){
    const header=await table.locator('thead').innerText();
    expect(header).toContain('Order Number');
    expect(header).toContain('Customer');
    expect(header).toContain('Mobile');
    expect(header).toContain('Product');
    expect(header).toContain('Order Total');
    await expect(page.locator('#crm1OrderDumpExcel')).toBeEnabled();
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#crm1OrderDumpExcel').click();
    const download=await downloadPromise;
    expect(download.suggestedFilename()).toBe('Order-Dump.csv');
  }
  expect(errors, errors.join('\\n')).toEqual([]);
});
