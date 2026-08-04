---
'@openfort/react': major
'create-openfort': major
---

Typed action results, a TanStack Query data layer, and a narrower supported runtime.

**Breaking**

- Requires React `>=18.3.1 <20`, viem `>=2.52.2 <3` and Node.js `^20.19.0 || >=22.12.0`. React 17 and Node.js 18 are no longer supported.
- `@tanstack/react-query` `>=5.99.2 <6` is now a required peer dependency. `OpenfortProvider` reuses the application's `QueryClient` when one is in scope and creates its own otherwise.
- Embedded-wallet actions resolve instead of rejecting: create and import return `{ account } | { error }`, activation `{ needsRecovery } | { error }`, recovery `{} | { error }` and export `{ privateKey } | { error }`. Branch on `error` before advancing a success path.
- Removed `OpenfortHookOptions.throwOnError`, `invalidateBalance()` (use the `useInvalidateBalance()` hook) and the `openfort:balance-invalidate` event.
- `openfortKeys` factories take a single parameters object. `useEthereumWalletAssets`, `useSolanaWalletAssets` and `useFundingChains` return the full TanStack query result, renaming `loading` to `isLoading`.

**Added**

- 28 exported error classes with composed messages, `cause` traversal and a version footer.
- `@openfort/react/internal` entry point for store internals, re-exported from the root as deprecated for one release.
- `"use client"` on every client-only module, preserved through the build and guarded by tests.

**Fixed**

- Serialized embedded-signer work and credential transitions, so a stale session can no longer publish wallet, user or callback state after logout or a newer sign-in.
- Scoped query keys per client and endpoint, keeping credentialed RPC URLs out of the cache and preventing cross-account reuse.
- Restricted funding and onramp links to their expected HTTPS origins.
- Connected on the chain the application selected rather than the chain a restored account was recorded with.
- Fixed builds for consumers that do not install the optional `wagmi` peer.

`create-openfort` scaffolds on Vite 8 with dependency ranges that satisfy the SDK peer ranges, and refuses to run on an unsupported Node.js version before touching the network or filesystem.
