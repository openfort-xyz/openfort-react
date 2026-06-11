import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { AUTH_STATE_EVM, AUTH_STATE_SOLANA, ROOT_OUT, TEST_RESULTS_DIR } from './tests/utils/constants'

const PORT = Number(process.env.PLAYGROUND_PORT ?? 5173)
const BASE_URL = process.env.PLAYGROUND_BASE_URL ?? `http://localhost:${PORT}`

const REPORT_DIR = path.join(ROOT_OUT, 'playwright-report')

export default defineConfig({
  testDir: './tests',

  timeout: 90_000,
  expect: { timeout: 30_000 },

  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
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

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\..+\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-evm',
      dependencies: ['setup'],
      testIgnore: [
        /auth\.spec\.ts/,
        /wallet-entry\.spec\.ts/,
        /refresh-persistence\.spec\.ts/,
        // Individual EVM tests replaced by evm-integration.spec.ts (storageState loses IndexedDB)
        /switch-chain-and-sign\.spec\.ts/,
        /write-contract\.spec\.ts/,
        /wallets-create-new\.spec\.ts/,
        /session-keys-multi-delete\.spec\.ts/,
      ],
      testMatch: /.*\.spec\.ts/,
      timeout: 180_000,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_EVM,
      },
    },
    {
      name: 'chromium-solana',
      dependencies: ['setup'],
      testIgnore: [
        /auth\.spec\.ts/,
        /wallet-entry\.spec\.ts/,
        /switch-chain-and-sign\.spec\.ts/,
        /write-contract\.spec\.ts/,
        /session-keys-multi-delete\.spec\.ts/,
        /refresh-persistence\.spec\.ts/,
        /evm-integration\.spec\.ts/,
      ],
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_STATE_SOLANA,
      },
    },
    {
      name: 'unauthenticated',
      testMatch: /(wallet-entry|auth)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
})
