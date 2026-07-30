import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { expect, test } from 'vitest'

// Vitest runs with the package root as the working directory; `import.meta.url`
// is not a file URL here because the module is served through the dev server.
const srcRoot = resolve(process.cwd(), 'src')

/** Test scaffolding and ambient declarations are never published, so they are not scanned. */
const excluded = /(\.test\.tsx?|\.test-d\.ts|\.d\.ts)$/

function sourceFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      files.push(...sourceFiles(path))
      continue
    }
    if (!/\.tsx?$/.test(entry.name) || excluded.test(entry.name)) continue
    files.push(path)
  }
  return files
}

/** Comments and their contents are prose, not code, and must not drive the verdict. */
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * A module is client-only once it calls a React hook or creates a context: both
 * throw when React evaluates the module in a React Server Component. Static JSX
 * and pure helpers render on the server just fine, so they are left alone —
 * over-marking a module would drag it and its imports into the client bundle.
 */
function isClientOnly(source: string) {
  const code = stripComments(source)
  const callsHook = /\buse[A-Z]\w*\s*(<[^;\n]*>)?\s*\(/.test(code)
  const createsContext = /\bcreateContext\s*[<(]/.test(code)
  return callsHook || createsContext
}

function hasUseClient(source: string) {
  return /^['"]use client['"]/.test(source.trimStart())
}

// Next.js App Router and other RSC bundlers evaluate an unmarked module on the
// server, where React hooks throw. Without the directive on every client-only
// module, importing `OpenfortButton` or any hook from a Server Component is a
// build error for the integrator — a failure mode no other test reaches.
test('every client-only module declares "use client"', () => {
  const missing = sourceFiles(srcRoot)
    .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
    .filter(({ source }) => isClientOnly(source) && !hasUseClient(source))
    .map(({ path }) => relative(srcRoot, path).split(sep).join('/'))
    .sort()

  expect(missing).toEqual([])
})
