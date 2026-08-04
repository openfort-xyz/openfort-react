import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

const dockerImage =
  'ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'

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

  const fallbackBin = path.join(sandbox, 'fallback-bin')
  const unsafeInstallMarker = path.join(sandbox, 'unsafe-install-command.txt')
  const nativeArgsPath = path.join(sandbox, 'native-args.txt')
  const dockerArgsPath = path.join(sandbox, 'docker-args.txt')
  const gitleaksPath = path.join(fallbackBin, 'gitleaks')
  const unamePath = path.join(fallbackBin, 'uname')
  const dockerPath = path.join(fallbackBin, 'docker')
  const brewPath = path.join(fallbackBin, 'brew')
  const curlPath = path.join(fallbackBin, 'curl')
  mkdirSync(fallbackBin)
  writeFileSync(unamePath, "#!/bin/sh\nprintf 'Darwin\\n'\n")
  writeFileSync(dockerPath, "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$GITLEAKS_DOCKER_ARGS\"\n")
  writeFileSync(brewPath, "#!/bin/sh\nprintf 'brew\\n' >> \"$UNSAFE_INSTALL_MARKER\"\n")
  writeFileSync(curlPath, "#!/bin/sh\nprintf 'curl\\n' >> \"$UNSAFE_INSTALL_MARKER\"\n")
  chmodSync(unamePath, 0o755)
  chmodSync(dockerPath, 0o755)
  chmodSync(brewPath, 0o755)
  chmodSync(curlPath, 0o755)

  const installCheck = spawnSync(path.join(repositoryRoot, '.husky/check_gitleaks.sh'), [], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${fallbackBin}:/usr/bin:/bin`,
      UNSAFE_INSTALL_MARKER: unsafeInstallMarker,
    },
  })
  if (installCheck.error) throw installCheck.error
  if (installCheck.status !== 0) {
    throw new Error(`Static gitleaks availability check failed unexpectedly: ${installCheck.stderr}`)
  }
  try {
    readFileSync(unsafeInstallMarker)
    throw new Error('The postinstall gitleaks check executed brew or curl')
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error
  }

  const packageManifest = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'))
  const postinstall = packageManifest.scripts?.postinstall ?? ''
  if (!postinstall.includes('./.husky/check_gitleaks.sh') || /install_gitleaks|brew|curl/.test(postinstall)) {
    throw new Error('The ordinary postinstall path must only perform the static gitleaks availability check')
  }

  writeFileSync(gitleaksPath, "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$GITLEAKS_NATIVE_ARGS\"\n")
  chmodSync(gitleaksPath, 0o755)

  const native = spawnSync(path.join(repositoryRoot, '.husky/run_gitleaks.sh'), [], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITLEAKS_NATIVE_ARGS: nativeArgsPath,
      PATH: `${fallbackBin}:/usr/bin:/bin`,
    },
  })
  if (native.error) throw native.error
  if (native.status !== 0) {
    throw new Error(`Native gitleaks invocation failed unexpectedly (exit ${native.status}): ${native.stderr}`)
  }

  const nativeArgs = readFileSync(nativeArgsPath, 'utf8').trim().split('\n')
  const expectedNativeArgs = ['git', '--staged', '--redact', '-v', '--config', '.gitleaks.toml']
  if (JSON.stringify(nativeArgs) !== JSON.stringify(expectedNativeArgs)) {
    throw new Error(`Native gitleaks arguments omit the reviewed config:\n${nativeArgs.join('\n')}`)
  }

  rmSync(gitleaksPath)
  writeFileSync(unamePath, "#!/bin/sh\nprintf 'Linux\\n'\n")

  const fallback = spawnSync(path.join(repositoryRoot, '.husky/run_gitleaks.sh'), [], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITLEAKS_DOCKER_ARGS: dockerArgsPath,
      PATH: `${fallbackBin}:/usr/bin:/bin`,
    },
  })
  if (fallback.error) throw fallback.error
  if (fallback.status !== 0) {
    throw new Error(`Docker fallback failed unexpectedly (exit ${fallback.status}): ${fallback.stderr}`)
  }

  const dockerArgs = readFileSync(dockerArgsPath, 'utf8').trim().split('\n')
  const expectedArgs = [
    'run',
    '--rm',
    '--network',
    'none',
    '-v',
    `${repositoryRoot}:/path:ro`,
    '-e',
    'GIT_CONFIG_COUNT=1',
    '-e',
    'GIT_CONFIG_KEY_0=safe.directory',
    '-e',
    'GIT_CONFIG_VALUE_0=/path',
    dockerImage,
    'git',
    '--staged',
    '--redact',
    '-v',
    '--config',
    '/path/.gitleaks.toml',
    '/path',
  ]
  if (JSON.stringify(dockerArgs) !== JSON.stringify(expectedArgs)) {
    throw new Error(`Docker fallback arguments differ from the hardened invocation:\n${dockerArgs.join('\n')}`)
  }

  const workflow = readFileSync(path.join(repositoryRoot, '.github/workflows/verify.yml'), 'utf8')
  if (!workflow.includes('gitleaks git --redact -v --exit-code 1 --config .gitleaks.toml')) {
    throw new Error('The CI secret scan does not load the reviewed .gitleaks.toml config')
  }
} finally {
  rmSync(sandbox, { recursive: true, force: true })
}
