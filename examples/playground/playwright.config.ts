import path from 'node:path'
import { defineConfig, devices, type Project } from '@playwright/test'
import { ANVIL_RPC_URL, FORK_MINT_CONTRACT, IS_FORK_RUN } from './tests/anvil/fork'
import { AUTH_STATE_EVM, AUTH_STATE_SOLANA, ROOT_OUT, TEST_RESULTS_DIR } from './tests/utils/constants'

const PORT = Number(process.env.PLAYGROUND_PORT ?? 5173)
const BASE_URL = process.env.PLAYGROUND_BASE_URL ?? `http://localhost:${PORT}`

const REPORT_DIR = path.join(ROOT_OUT, 'playwright-report')

/** Suites whose chain reads resolve against the anvil fork; excluded from live runs. */
const FORK_SPECS = /\.fork\.spec\.ts/

/**
 * Guest sign-in runs against live Openfort in both modes, so a fork run still needs
 * it — but only the EVM half, since no fork-backed suite touches Solana.
 */
const setup: Project = {
  name: 'setup',
  testMatch: IS_FORK_RUN ? /auth\.setup\.evm\.ts/ : /.*\.setup\..+\.ts/,
  use: { ...devices['Desktop Chrome'] },
}

const forkProject: Project = {
  name: 'chromium-evm-fork',
  dependencies: ['setup'],
  testMatch: FORK_SPECS,
  timeout: 240_000,
  use: {
    ...devices['Desktop Chrome'],
    storageState: AUTH_STATE_EVM,
  },
}

const liveProjects: Project[] = [
  {
    name: 'chromium-evm',
    dependencies: ['setup'],
    testIgnore: [
      FORK_SPECS,
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
      FORK_SPECS,
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
]

export default defineConfig({
  testDir: './tests',

  timeout: 90_000,
  expect: { timeout: 30_000 },

  // Chain state is deterministic on a fork, so a fork run only retries for the live
  // sign-in it still depends on.
  retries: process.env.CI ? (IS_FORK_RUN ? 1 : 2) : 0,
  // One anvil instance is shared by the whole run (the dev server resolves its RPC
  // URL once, at build time), so fork-backed suites must not race on chain state.
  workers: IS_FORK_RUN ? 1 : process.env.CI ? 2 : 4,
  fullyParallel: false,

  reporter: [['list'], ['html', { outputFolder: REPORT_DIR, open: 'never' }]],

  outputDir: TEST_RESULTS_DIR,

  globalSetup: IS_FORK_RUN ? './tests/anvil/global-setup.ts' : undefined,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
    viewport: { width: 1440, height: 900 },
  },

  projects: [setup, ...(IS_FORK_RUN ? [forkProject] : liveProjects)],

  webServer: {
    // `--port` keeps vite on the port BASE_URL points at instead of letting it pick
    // the next free one when 5173 is taken.
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    // A fork run needs its own dev server: the fork RPC URL below is baked in at
    // startup, so an already-running server would still be talking to public nodes.
    reuseExistingServer: !process.env.CI && !IS_FORK_RUN,
    env: IS_FORK_RUN
      ? {
          VITE_EVM_FORK_RPC_URL: ANVIL_RPC_URL,
          // The fork serves Base Sepolia, so pin the mint contract to the one deployed
          // there instead of whatever the live runs configure.
          VITE_POLYGON_MINT_CONTRACT: FORK_MINT_CONTRACT,
        }
      : {},
  },
})
