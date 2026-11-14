import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const root = process.cwd()
const webLocalEnv = path.join(root, 'server', '.env.web-local')
if (fs.existsSync(webLocalEnv)) {
  dotenv.config({ path: webLocalEnv })
}

const baseURL = process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:5173'
// Prefer Playwright Chromium; fall back to system Chrome/Edge when download fails.
const browserChannel =
  process.env.GNH_E2E_CHANNEL ||
  (process.env.GNH_E2E_USE_SYSTEM_CHROME === '1' ? 'chrome' : undefined)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel as 'chrome' | 'msedge' } : {}),
      },
    },
    {
      // Chromium + iPhone viewport (system Edge/Chrome; no WebKit binary required).
      name: 'iphone',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        ...(browserChannel ? { channel: browserChannel as 'chrome' | 'msedge' } : {}),
      },
      testMatch: /smoke-shell\.spec\.ts/,
    },
    {
      name: 'android',
      use: {
        ...devices['Pixel 7'],
        ...(browserChannel ? { channel: browserChannel as 'chrome' | 'msedge' } : {}),
      },
      testMatch: /smoke-shell\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'node scripts/dev-web-local.mjs',
      cwd: path.join(root, 'server'),
      url: 'http://127.0.0.1:3001/api/games/mafia-shadows/ready',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev:web -- --host 127.0.0.1 --port 5173',
      cwd: root,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
