import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;
/** Segundo servidor: modo de pago (PayPal simulado; ver tests/e2e/paywall.spec.ts). */
const PAY_PORT = 3201;

/**
 * E2E contra `next start` en modo test (APP_ENV=test: store y email en memoria; jamás permitido en
 * producción de Vercel). Requiere `npm run build` previo (el CI lo hace).
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-360', testIgnore: /paywall/, use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
    { name: 'desktop-1280', testIgnore: /paywall/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'pay-mobile-360',
      testMatch: /paywall/,
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 }, baseURL: `http://localhost:${PAY_PORT}` },
    },
    {
      name: 'pay-desktop-1280',
      testMatch: /paywall/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, baseURL: `http://localhost:${PAY_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        APP_ENV: 'test',
        NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
        MONETIZATION_MODE: 'validation',
        STRIPE_ENABLED: 'false',
        OWNER_EMAIL: 'owner@morrowage.test',
        EMAIL_FROM: 'MorrowAge <reports@morrowage.test>',
      },
    },
    {
      command: `npx next start -p ${PAY_PORT}`,
      url: `http://localhost:${PAY_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        APP_ENV: 'test',
        NEXT_PUBLIC_APP_URL: `http://localhost:${PAY_PORT}`,
        MONETIZATION_MODE: 'paypal',
        STRIPE_ENABLED: 'false',
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'sb-e2e-client-id',
        PAYPAL_CLIENT_SECRET: 'dummy-secret',
        PAYPAL_WEBHOOK_ID: 'WH-E2E-0001',
        PAYMENTS_LIVE_APPROVED: 'false',
        REPORT_PRICE_USD: '19.00',
        OWNER_EMAIL: 'owner@morrowage.test',
        EMAIL_FROM: 'MorrowAge <reports@morrowage.test>',
      },
    },
  ],
});
