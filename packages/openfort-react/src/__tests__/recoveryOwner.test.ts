import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { expect, test } from 'vitest'

// Vitest runs with the package root as the working directory.
const srcRoot = resolve(process.cwd(), 'src')

/** The single owner of `embeddedWallet.recover()`, relative to `src/`. */
const owner = 'actions/ensureEmbeddedSignerHolds.ts'

/** Test scaffolding models the client, so it names `recover` without owning it. */
const excluded = /(\.test\.tsx?|\.test-d\.ts|\.d\.ts)$/

function sourceFiles(): string[] {
  return readdirSync(srcRoot, { recursive: true, encoding: 'utf8' })
    .map((path) => path.split(sep).join('/'))
    .filter((path) => /\.tsx?$/.test(path) && !excluded.test(path) && !path.startsWith('__tests__/'))
}

/** Comments and their contents are prose, not code, and must not drive the verdict. */
function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

// Recovery is requested from three places on a single login, and every
// `embeddedWallet.recover()` derives its own credential — on a passkey account
// that is a WebAuthn ceremony the user has to answer. `ensureEmbeddedSignerHolds`
// decides whether an account still needs recovering by asking the signer; a
// fourth caller reaching around it would prompt again for a signer that is
// already configured, which no behavioural test covers because each path is
// correct on its own.
test('embeddedWallet.recover() is called only by its owner', () => {
  const callers = sourceFiles()
    .filter((path) =>
      /\bembeddedWallet\s*\.\s*recover\s*\(/.test(stripComments(readFileSync(join(srcRoot, path), 'utf8')))
    )
    .sort()

  expect(callers).toEqual([owner])
})
