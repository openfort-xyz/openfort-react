// Type-checks the built package the way a consumer does, under both module
// resolution modes, and fails on any diagnostic raised inside the SDK's own
// shipped declarations.
//
// `skipLibCheck` is off (see tsconfig.json), so tsc reads every `.d.ts` in the
// program rather than trusting it. That reaches the whole peer graph — wagmi,
// viem, WalletConnect, the Solana packages — and several of those ship
// declarations that do not type-check on their own. Failing on those would gate
// this repository on other projects' releases, so only diagnostics whose file
// lives in `packages/openfort-react/build` count. That scope is what catches a
// shipped `.d.ts` referring to a name it never imported, which nothing else
// here sees: rollup-plugin-typescript2 emits such a file without complaint, and
// publint and attw both read it as valid.
//
// Narrowing the diagnostics that way means a run that checked nothing would
// otherwise look identical to a clean one, so each run also asserts that the
// declarations were in the program at all.

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const declarationDir = `${path.resolve(here, '../../packages/openfort-react/build')}${path.sep}`
const tscBin = createRequire(import.meta.url).resolve('typescript/bin/tsc')

const resolutionModes = [
  ['--module', 'esnext', '--moduleResolution', 'bundler'],
  ['--module', 'node16', '--moduleResolution', 'node16'],
]

/** Matches the `file(line,col): error TSxxxx: message` line that opens a diagnostic. */
const diagnosticHeader = /^(\S.*?)\(\d+,\d+\): (?:error|warning) TS\d+:/

function isInDeclarationDir(file) {
  return path.resolve(here, file).startsWith(declarationDir)
}

/** The SDK's declarations and this environment's own consumer file, which must both compile. */
function isOwned(file) {
  const resolved = path.resolve(here, file)
  return isInDeclarationDir(resolved) || path.dirname(resolved) === here
}

/**
 * Splits `tsc --listFiles` output into the diagnostics raised against files
 * this repository owns and the count of SDK declarations the program loaded.
 *
 * tsc continues a diagnostic across indented follow-on lines, so an unindented
 * line ends the previous diagnostic and every indented line belongs to it.
 * Unindented lines that are not diagnostics are the file listing.
 */
function readReport(output) {
  const diagnostics = []
  let loaded = 0
  let keeping = false
  for (const line of output.split('\n')) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (keeping) diagnostics.push(line)
      continue
    }
    const header = diagnosticHeader.exec(line)
    if (header) {
      keeping = isOwned(header[1])
      if (keeping) diagnostics.push(line)
      continue
    }
    keeping = false
    if (line.endsWith('.d.ts') && isInDeclarationDir(line)) loaded += 1
  }
  return { diagnostics, loaded }
}

let failed = false
for (const mode of resolutionModes) {
  const label = mode.join(' ')
  const tsc = spawnSync(process.execPath, [tscBin, '--pretty', 'false', '--listFiles', ...mode], {
    cwd: here,
    encoding: 'utf8',
    // `--listFiles` names every file in the peer graph, well past the 1 MB default.
    maxBuffer: 64 * 1024 * 1024,
  })

  if (tsc.error) {
    console.error(`Could not run tsc (${label}): ${tsc.error.message}`)
    process.exit(1)
  }

  const { diagnostics, loaded } = readReport(`${tsc.stdout}${tsc.stderr}`)

  if (loaded === 0) {
    failed = true
    console.error(
      `No @openfort/react declaration reached the program (${label}), so nothing was checked. ` +
        `Build the package first, and check that this environment still resolves it.`
    )
    console.error(tsc.stdout.trim() || tsc.stderr.trim())
    continue
  }

  if (diagnostics.length > 0) {
    failed = true
    console.error(`Type-checking the built @openfort/react failed (${label}):`)
    console.error(diagnostics.join('\n'))
    continue
  }

  console.log(`${loaded} built declarations type-check (${label}).`)
}

process.exit(failed ? 1 : 0)
