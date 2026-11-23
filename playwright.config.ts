import { defineConfig, devices } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const root = process.cwd()
const webLocalEnv = path.join(root, 'server', '.env.web-local')
if (fs.existsSync(webLocalEnv)) {
  dotenv.config({ path: webLocalEnv })
}

/**
 * Default WEB E2E target is Vite --mode web on 5173.
 * A stale GNH_E2E_BASE_URL (e.g. leftover preview on 4174) previously caused
 * Playwright to drive an old build without the devices block while starting
 * a fresh Vite on a different port — reuseExistingServer alone could not fix that.
 */
const baseURL = process.env.GNH_E2E_BASE_URL || 'http://127.0.0.1:5173'
let webPort = 5173
try {
  const u = new URL(baseURL)
  webPort = Number(u.port || (u.protocol === 'https:' ? 443 : 80)) || 5173
} catch {
  webPort = 5173
}
const apiReadyUrl = process.env.GNH_E2E_API_READY_URL || 'http://127.0.0.1:3001/api/games/mafia-shadows/ready'

// Prefer Playwright Chromium; fall back to system Chrome/Edge when download fails.
const browserChannel =
  process.env.GNH_E2E_CHANNEL ||
  (process.env.GNH_E2E_USE_SYSTEM_CHROME === '1' ? 'chrome' : undefined)

// Never reuse by default — stale Vite/preview was the root cause of missing devices UI.
const reuseExistingServer = process.env.GNH_E2E_REUSE === '1'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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
      url: apiReadyUrl,
      reuseExistingServer,
      timeout: 180_000,
    },
    {
      command: `npm run dev:web -- --host 127.0.0.1 --port ${webPort}`,
      cwd: root,
      url: baseURL,
      reuseExistingServer,
      timeout: 180_000,
    },
  ],
})
