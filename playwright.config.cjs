const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/crm1',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.CRM1_BASE_URL || 'https://aaroogyamayurveda.in',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
