---
'@openfort/react': minor
---

Mark every client-only module with `"use client"` and preserve the directive through the build.

`OpenfortButton` and 24 other modules that call React hooks shipped without the directive, so importing them from a Next.js App Router Server Component failed the build. Rollup also strips module-level directives while parsing, which meant the 151 modules that already declared it published without it. The build now restores the directive on every chunk whose source declares one, and two guards keep it that way: a unit test over `src/` and a `test:build` check against the built output.

Add a `@openfort/react/internal` entry point for implementation machinery. `StoreContext`, the `OpenfortStore`/`OpenfortStoreState` types, and the seven `select*` functions now live there. They remain re-exported from the root as deprecated for one release.

Deprecate three names in favour of their canonical spelling: `OpenfortReactErrorType` (use `OpenfortErrorType`), `useOpenfortCore` (use `useOpenfort`), and `wallets` from `@openfort/react/wagmi` (use `getDefaultConnectors`). Each alias still resolves to the same value.

Export `useSolanaWalletAssets` from `@openfort/react/solana`, matching `useEthereumWalletAssets` on the Ethereum entry point.
