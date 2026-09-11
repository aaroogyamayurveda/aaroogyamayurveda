import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  testMatch: 'roles-fast.spec.js',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: process.env.CI ? 6 : undefined,
  retries: 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.CRM2_BASE_URL || 'https://aaroogyamayurveda.in/crm2/',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  outputDir: 'test-results',
});
