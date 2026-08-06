/**
 * Asserts .gitleaks.toml still detects a real secret.
 *
 * The config replaces the default ruleset and carries an allowlist of keys that
 * ship by design. A regex there that matches too much, or a dropped
 * `useDefault`, silences the scanner without failing anything else — including
 * in test files and examples, where a leaked key is just as live.
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sandbox = mkdtempSync(path.join(tmpdir(), 'openfort-gitleaks-config-'))
const privateKeyLabel = ['PRIVATE', 'KEY'].join(' ')
const syntheticSecret = [
  `-----BEGIN ${privateKeyLabel}-----\n`,
  'Q09ERVhfU0VDUkVUX1NDQU5ORVJfUkVHUkVTU0lPTl9QUk9CRV9PTkxZ\n',
  `-----END ${privateKeyLabel}-----\n`,
].join('')

const probes = [
  'packages/openfort-react/src/security-probe.ts',
  'packages/openfort-react/src/security-probe.test.ts',
  'packages/openfort-react/src/__tests__/security-probe.ts',
  'examples/security-probe.env.example',
]

try {
  for (const probe of probes) {
    const absolutePath = path.join(sandbox, probe)
    mkdirSync(path.dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, syntheticSecret)

    const result = spawnSync(
      'gitleaks',
      ['dir', probe, '--config', path.join(repositoryRoot, '.gitleaks.toml'), '--no-banner', '--redact'],
      { cwd: sandbox, encoding: 'utf8' }
    )

    if (result.error) throw result.error
    if (result.status === 0) throw new Error(`gitleaks did not scan the synthetic secret in ${probe}`)
    if (result.status !== 1) {
      throw new Error(`gitleaks failed unexpectedly for ${probe} (exit ${result.status}): ${result.stderr}`)
    }
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}

console.log(`.gitleaks.toml detects a secret in all ${probes.length} probe locations.`)
