import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;

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
    { name: 'mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 740 } } },
    { name: 'desktop-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
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
});
