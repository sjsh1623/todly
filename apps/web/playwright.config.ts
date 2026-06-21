import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright e2e config for todly.
 *
 * Targets a locally running dev/preview server. Before running:
 *   1. npx playwright install        # one-time: download browsers
 *   2. npm run test:e2e              # boots `vite preview` via webServer below
 *
 * The webServer block builds + previews the app on :4173 so specs run against
 * a production-like bundle. Override the base URL with PLAYWRIGHT_BASE_URL.
 */
const PORT = 4173
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry locally too: specs hit a single shared dev server + API, so an
  // occasional slow auth-bootstrap under parallel load shouldn't fail the run.
  retries: process.env.CI ? 2 : 1,
  // Cap parallelism to keep signup/refresh contention on the shared API modest.
  workers: process.env.CI ? 1 : 3,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Only start a server when targeting the default local URL.
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port ' + PORT,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
