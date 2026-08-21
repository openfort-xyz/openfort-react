#!/usr/bin/env node

/**
 * Regenerates packages/openfort-react/src/version.ts from the version in that
 * package's package.json, so the SDK can report its own version at runtime
 * without importing package.json.
 *
 * The version file is generated in full, so it is safe to reformat or delete.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const packageDir = join(repoRoot, 'packages', 'openfort-react')
const packageJsonPath = join(packageDir, 'package.json')
const versionFilePath = join(packageDir, 'src', 'version.ts')

async function readPackageVersion() {
  let manifest
  try {
    manifest = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  } catch (cause) {
    throw new Error(`cannot read ${packageJsonPath}: ${cause.message}`, { cause })
  }
  if (typeof manifest.version !== 'string' || manifest.version === '') {
    throw new Error(`${packageJsonPath} has no "version" field`)
  }
  return manifest.version
}

try {
  const version = await readPackageVersion()
  await writeFile(versionFilePath, `export const OPENFORT_VERSION = '${version}'\n`, 'utf8')
  console.log(`Wrote ${relative(repoRoot, versionFilePath)} — ${version}`)
} catch (error) {
  console.error(`update-version failed: ${error.message}`)
  process.exit(1)
}
