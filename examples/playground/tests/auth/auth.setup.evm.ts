import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { AuthPage } from '../pages/auth.page'
import { DashboardPage } from '../pages/dashboard.page'
import { AUTH_STATE_EVM, TEST_RESULTS_DIR } from '../utils/constants'
import { setPlaygroundMode } from '../utils/mode'

test('setup: create guest wallet (evm) and persist auth state', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUTH_STATE_EVM), { recursive: true })
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true })

  await setPlaygroundMode(page, 'evm')

  const auth = new AuthPage(page)
  const dash = new DashboardPage(page)

  await auth.goto()
  await auth.continueAsGuest('evm')

  await dash.expectLoaded('evm')

  await page.context().storageState({ path: AUTH_STATE_EVM })
  expect(fs.existsSync(AUTH_STATE_EVM)).toBeTruthy()
})
