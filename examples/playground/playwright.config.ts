import { readdirSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, devices, type Project } from '@playwright/test'
import {
  AUTH_STATE_EVM,
  AUTH_STATE_EVM_REFRESH,
  AUTH_STATE_SOLANA,
  ROOT_OUT,
  TEST_RESULTS_DIR,
} from './tests/utils/constants.js'

const PORT = Number(process.env.PLAYGROUND_PORT ?? 5173)
const BASE_URL = process.env.PLAYGROUND_BASE_URL ?? `http://127.0.0.1:${PORT}`

const REPORT_DIR = path.join(ROOT_OUT, 'playwright-report')

const EVM_LIVE_SPECS = ['evm-integration.spec.ts']
/** Runs on its own guest — see AUTH_STATE_EVM_REFRESH for why. */
const EVM_REFRESH_SPECS = ['refresh-persistence.spec.ts']
const SOLANA_LIVE_SPECS = ['wallets-create-new.spec.ts']
const UNAUTHENTICATED_SPECS = ['auth.spec.ts']
const SMOKE_SPECS = ['offline.smoke.spec.ts', 'offline.security.spec.ts']
const IS_SMOKE_RUN = process.env.PLAYGROUND_SMOKE === '1'

/** Fail configuration loading when a suite can silently fall outside every project. */
function assertEverySpecHasAnOwner() {
  const specsRoot = path.join(import.meta.dirname, 'tests/specs')
  const specFiles: string[] = []
  const collectSpecs = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        collectSpecs(absolutePath)
      } else if (entry.name.endsWith('.spec.ts')) {
        specFiles.push(path.relative(specsRoot, absolutePath).split(path.sep).join('/'))
      }
    }
  }
  collectSpecs(specsRoot)

  const explicitlyOwned = new Set([
    ...EVM_LIVE_SPECS,
    ...EVM_REFRESH_SPECS,
    ...SOLANA_LIVE_SPECS,
    ...UNAUTHENTICATED_SPECS,
    ...SMOKE_SPECS,
  ])
  const unowned = specFiles.filter((file) => !explicitlyOwned.has(file))
  const missing = [...explicitlyOwned].filter((file) => !specFiles.includes(file))

  if (unowned.length > 0 || missing.length > 0) {
    throw new Error(
      `Playwright spec ownership is invalid (unowned: ${unowned.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'})`
    )
  }
}

assertEverySpecHasAnOwner()

/** Guest sign-in runs against live Openfort. */
const setup: Project = {
  name: 'setup',
  testMatch: /.*\.setup\..+\.ts/,
  use: { ...devices['Desktop Chrome'] },
}

const smokeProject: Project = {
  name: 'chromium-offline-smoke',
  testMatch: SMOKE_SPECS.map((file) => `**/${file}`),
  use: { ...devices['Desktop Chrome'] },
}

const liveProjects: Project[] = [
  {
    name: 'chromium-evm',
    dependencies: ['setup'],
    testMatch: EVM_LIVE_SPECS.map((file) => `**/${file}`),
    timeout: 180_000,
    use: {
      ...devices['Desktop Chrome'],
      storageState: AUTH_STATE_EVM,
    },
  },
  {
    name: 'chromium-evm-refresh',
    dependencies: ['setup'],
    testMatch: EVM_REFRESH_SPECS.map((file) => `**/${file}`),
    timeout: 180_000,
    use: {
      ...devices['Desktop Chrome'],
      storageState: AUTH_STATE_EVM_REFRESH,
    },
  },
  {
    name: 'chromium-solana',
    dependencies: ['setup'],
    testMatch: SOLANA_LIVE_SPECS.map((file) => `**/${file}`),
    use: {
      ...devices['Desktop Chrome'],
      storageState: AUTH_STATE_SOLANA,
    },
  },
  {
    name: 'unauthenticated',
    testMatch: UNAUTHENTICATED_SPECS.map((file) => `**/${file}`),
    use: { ...devices['Desktop Chrome'] },
  },
]

export default defineConfig({
  testDir: './tests',

  timeout: 90_000,
  expect: { timeout: 30_000 },

  retries: IS_SMOKE_RUN ? 0 : process.env.CI ? 2 : 0,
  workers: IS_SMOKE_RUN ? 1 : process.env.CI ? 2 : 4,
  fullyParallel: false,

  reporter: [['list'], ['html', { outputFolder: REPORT_DIR, open: 'never' }]],

  outputDir: TEST_RESULTS_DIR,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
    viewport: { width: 1440, height: 900 },
  },

  projects: IS_SMOKE_RUN ? [smokeProject] : [setup, ...liveProjects],

  webServer: {
    // `--port` keeps vite on the port BASE_URL points at instead of letting it pick
    // the next free one when 5173 is taken.
    command: `./node_modules/.bin/vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI && !IS_SMOKE_RUN,
    env: IS_SMOKE_RUN
      ? {
          VITE_OPENFORT_PUBLISHABLE_KEY: 'pk_test_offline_browser_smoke',
          VITE_SHIELD_PUBLISHABLE_KEY: 'pk_test_offline_browser_smoke',
        }
      : {},
  },
})
