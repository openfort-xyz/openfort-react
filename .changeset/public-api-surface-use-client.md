---
'@openfort/react': minor
---

Marked every client-only module with `"use client"` and preserved the directive through the build.

`OpenfortButton` and 24 other modules that call React hooks shipped without the directive, so importing them from a Next.js App Router Server Component failed the build. Rollup also strips module-level directives while parsing, which meant the 151 modules that already declared it published without it. The build now restores the directive on every chunk whose source declares one, and two guards keep it that way: a unit test over `src/` and a `test:build` check against the built output.

Added a `@openfort/react/internal` entry point for implementation machinery. `StoreContext`, the `OpenfortStore`/`OpenfortStoreState` types, and the seven `select*` functions now live there. They remain re-exported from the root as deprecated for one release.

Deprecated `OpenfortReactErrorType` in favour of narrowing on concrete error classes, `useOpenfortCore` in favour of `useOpenfort`, and `wallets` from `@openfort/react/wagmi` in favour of `getDefaultConnectors`. The compatibility exports remain available.

Exported `useSolanaWalletAssets` and its public asset and result types from `@openfort/react/solana`, matching `useEthereumWalletAssets` on the Ethereum entry point.
