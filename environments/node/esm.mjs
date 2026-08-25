// Resolves every published entry point in bare Node and asserts the output
// evaluates. The package is client-only at runtime, but a server-rendered app
// still imports it on the server: Next.js evaluates every module in a route's
// graph before React decides what to render. A module-scope reference to
// `window`, or a broken relative specifier in the emitted ESM, fails here
// rather than in a consumer's build.
import assert from 'node:assert/strict'

import { OpenfortButton, OpenfortProvider, OPENFORT_VERSION, useUser } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { selectIsAuthenticated, StoreContext } from '@openfort/react/internal'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { embeddedWalletConnector, getDefaultConfig } from '@openfort/react/wagmi'

assert.equal(typeof OpenfortProvider, 'function')
assert.equal(typeof OpenfortButton, 'function')
assert.equal(typeof useUser, 'function')
// The version constant is generated at build time, so a stale or missing
// generation step shows up as a value that does not look like a version.
assert.match(OPENFORT_VERSION, /^\d+\.\d+\.\d+/)

assert.equal(typeof useEthereumEmbeddedWallet, 'function')
assert.equal(typeof useSolanaEmbeddedWallet, 'function')

assert.equal(typeof getDefaultConfig, 'function')
assert.equal(typeof embeddedWalletConnector, 'function')

// The internal entry point ships the store context and its selectors. A React
// context object is what makes the store shareable across the entry points, so
// a plain function here would mean the build split it into two copies.
assert.equal(typeof selectIsAuthenticated, 'function')
assert.ok(StoreContext.Provider)

console.log('esm: ok')
