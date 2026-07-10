import { defineConfig, devices } from '@playwright/test';

// End-to-end happy-path tests. They run against a throwaway API (its own data
// dir, wiped in global-setup) and a Vite dev server pointed at it, so a run
// never touches dev or prod data. `npm run e2e`.
const API_PORT = 4099;
const WEB_PORT = 5199;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `JWT_SECRET=e2e R5C_DATA_DIR=.e2e-data PORT=${API_PORT} node server/index.js`,
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `VITE_API_URL=http://localhost:${API_PORT} npm run dev -- --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
