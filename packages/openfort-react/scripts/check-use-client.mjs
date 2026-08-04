#!/usr/bin/env node
/**
 * Asserts every published module that declares `'use client'` in `src/` still
 * declares it in `build/`.
 *
 * The vitest guard covers the source tree, but the directive only reaches
 * integrators if it survives bundling — and Rollup strips module-level
 * directives while parsing. This runs against the real build output, so a build
 * config regression fails here instead of in a consumer's Next.js App Router.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const srcRoot = join(packageRoot, 'src')
const buildRoot = join(packageRoot, 'build')

const directivePattern = /^\s*(['"])use client\1\s*;?/
const excluded = /(\.test\.tsx?|\.test-d\.ts|\.d\.ts)$/

function sourceFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') files.push(...sourceFiles(path))
      continue
    }
    if (/\.tsx?$/.test(entry.name) && !excluded.test(entry.name)) files.push(path)
  }
  return files
}

function buildPath(sourcePath) {
  return join(buildRoot, relative(srcRoot, sourcePath).replace(/\.tsx?$/, '.js'))
}

try {
  statSync(buildRoot)
} catch {
  console.error('build/ is missing — run `pnpm build` before this check.')
  process.exit(1)
}

const failures = []
for (const sourcePath of sourceFiles(srcRoot)) {
  if (!directivePattern.test(readFileSync(sourcePath, 'utf8'))) continue
  const outputPath = buildPath(sourcePath)
  let output
  try {
    output = readFileSync(outputPath, 'utf8')
  } catch {
    // Tree-shaken away entirely: nothing ships, so nothing needs the directive.
    continue
  }
  if (!directivePattern.test(output)) {
    failures.push(relative(packageRoot, outputPath).split(sep).join('/'))
  }
}

if (failures.length > 0) {
  console.error(`Missing "use client" in ${failures.length} built module(s):`)
  for (const path of failures) console.error(`  ${path}`)
  process.exit(1)
}

console.log('"use client" preserved in every built client module.')
