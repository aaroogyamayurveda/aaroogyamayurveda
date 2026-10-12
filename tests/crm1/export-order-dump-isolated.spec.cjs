const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

test('isolated Export Order Dump: navigation, CHETS columns, mapping and CSV download', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><title>Isolated test</title></head><body><nav id="nav"><button id="fixtureOtherNav" type="button">Dashboard</button></nav><div class="main"><section id="dashboard" class="page active"><h2>Dashboard</h2></section></div></body></html>');

  // Mimic the navigation reset locally; this fixture never opens live CRM1.
  await page.evaluate(() => {
    document.addEventListener('click', event => {
      if (!event.target.closest('#nav button')) return;
      requestAnimationFrame(() => {
        document.querySelectorAll('.main .page').forEach(el => el.classList.remove('active'));
        document.querySelector('#dashboard').classList.add('active');
      });
    }, true);

    const order = {
      order_no: 'ORD-ISOLATED-101',
      order_date: '2026-10-10',
      order_status: 'new',
      total_amount: '1999',
      customer_id: 1,
      shipping_address: '12 Test Street',
      city: 'Indore',
      state: 'Madhya Pradesh',
      pin_code: '452001',
      customers: {
        customer_name: 'Test Client',
        mobile: '9876543210',
        address: 'Customer fallback address',
        city: 'Customer City',
        state: 'Customer State',
        pincode: '111111'
      },
      order_items: [{
        product_id: 1,
        qty: 2,
        quantity: 2,
        unit_price: 100,
        products: { product_name: 'Ortho Gold' }
      }]
    };

    window.sb = {
      from(table) {
        if (table !== 'orders') throw new Error('Unexpected table: ' + table);
        return {
          select() { return this; },
          gte() { return this; },
          lt() { return this; },
          order() { return this; },
          range() { return Promise.resolve({ data: [order], error: null }); }
        };
      }
    };
  });

  await page.addScriptTag({ path: path.resolve(__dirname, '../../crm1/crm1-export-order-dump.js') });

  const navButton = page.locator('#nav button').filter({ hasText: 'Export Order Dump' });
  await expect(navButton).toBeVisible();
  await navButton.click();

  const workspace = page.locator('#crm1ExportOrderDumpPage');
  await expect(workspace).toBeVisible();
  await expect(workspace.locator('h2')).toContainText('Export Order Dump');

  await page.locator('#crm1OrderDumpFrom').fill('2026-10-01');
  await page.locator('#crm1OrderDumpTo').fill('2026-10-31');
  await page.locator('#crm1OrderDumpGenerate').click();

  const table = workspace.locator('table.crm1-dump-table');
  await expect(table).toBeVisible();
  const headers = (await table.locator('thead th').allTextContents()).map(s => s.trim());
  expect(headers).toEqual([
    'BATCH DATE', 'ORDER ID', 'CLIENT', 'MOBILE', 'CITY', 'DISTRICT',
    'ADDRESS', 'PIN', 'STATE', 'PRODUCT', 'QTY', 'PRICE',
    'HUB CODE', 'STATUS', 'REMARK'
  ]);

  const cells = await table.locator('tbody tr').first().locator('td').allTextContents();
  expect(cells).toHaveLength(15);
  expect(cells[0]).toBe('10/10/2026');
  expect(cells[1]).toBe('ORD-ISOLATED-101');
  expect(cells[2]).toBe('Test Client');
  expect(cells[3]).toBe('9876543210');
  expect(cells[4]).toBe('Indore');
  expect(cells[5]).toBe('Indore');
  expect(cells[6]).toBe('12 Test Street');
  expect(cells[7]).toBe('452001');
  expect(cells[8]).toBe('Madhya Pradesh');
  expect(cells[9]).toBe('Ortho Gold');
  expect(cells[10]).toBe('2');
  expect(cells[11]).toBe('1999');
  expect(cells.slice(12)).toEqual(['', '', '']);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#crm1OrderDumpExcel').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Order-Dump.csv');
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csv = await fs.readFile(downloadPath, 'utf8');
  const csvText = csv.replace(/^\uFEFF/, '');
  const csvLines = csvText.trim().split(/\r?\n/);
  expect(csvLines[0].split(',')).toEqual(headers);
  expect(csvLines).toHaveLength(2);
  expect(csvLines[1]).toContain('ORD-ISOLATED-101');
  expect(csvLines[1]).toContain('Ortho Gold');
  expect(pageErrors).toEqual([]);
});
