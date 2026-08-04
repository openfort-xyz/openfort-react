---
'@openfort/react': major
'create-openfort': major
---

Typed action results, a TanStack Query data layer, and a narrower supported runtime.

**Breaking**

- `@openfort/react` requires React `>=18.3.1 <20`, viem `>=2.52.2 <3` and Node.js `>=20`. React 17 and Node.js 18 are no longer supported. `create-openfort` needs Node.js `^20.19.0 || >=22.12.0`, because the project it scaffolds builds on Vite 8.
- `@tanstack/react-query` `>=5.99.2 <6` is now a required peer dependency. `OpenfortProvider` reuses the application's `QueryClient` when one is in scope and creates its own otherwise.
- Embedded-wallet actions resolve instead of rejecting: create and import return `{ account } | { error }`, activation `{ needsRecovery } | { error }`, recovery `{} | { error }` and export `{ privateKey } | { error }`. Branch on `error` before advancing a success path.
- Removed `OpenfortHookOptions.throwOnError`, `invalidateBalance()` (use the `useInvalidateBalance()` hook) and the `openfort:balance-invalidate` event.
- `openfortKeys` factories take a single parameters object. `useEthereumWalletAssets`, `useSolanaWalletAssets` and `useFundingChains` return the full TanStack query result, renaming `loading` to `isLoading`.
- Removed the `OpenfortReactErrorType` enum, its `OpenfortErrorType` alias and the `type` field on every error. Narrow with `instanceof` or `error.name` against the exported error classes instead — `error.type === OpenfortErrorType.WALLET_ERROR` becomes `error instanceof WalletError`.
- Store internals (`StoreContext`, `OpenfortStore`, `OpenfortStoreState` and the `select*` selectors) are only available from `@openfort/react/internal`; the root re-exports are gone.
- Removed the `useOpenfortCore` alias (use `useOpenfort`), the `wallets` alias in `@openfort/react/wagmi` (use `getDefaultConnectors`), the no-op `setDefaultClient()` and the ignored `sessionKey` option on `useGrantPermissions`.
- `useSignMessage` and `use7702Authorization` resolve instead of rejecting. `signMessage`/`signTypedData` return `{ signature } | { error }` and `signAuthorization` returns a `{ status }` result, so a dismissed prompt no longer rejects — branch on the result rather than relying on `try`/`catch`.
- Removed `OpenfortError.data`. The replacement fields are `shortMessage`, `details`, `metaMessages` and `cause`.
- `logger.warn` and `logger.error` always emit, regardless of `debugMode`. Only `logger.log` remains gated. Credentials are redacted from anything logged.
- `getDefaultConfig` sets wagmi's `ssr: true`, so `useAccount()` reports `reconnecting` on the first render instead of `connected`. Gate on `isConnected === false && status !== 'reconnecting'` before showing a signed-out view.
- `setEmbeddedWalletProvider` (`@openfort/react/wagmi`) takes the Openfort client as a second argument.
- `@wagmi/core` is a new optional peer dependency, installed automatically alongside `wagmi`.
- `walletConfig.createEncryptedSessionEndpoint` now receives an `Authorization: Bearer <access token>` header. Endpoints that reject unknown headers, or that were relying on being callable anonymously, need updating — see the hardened `create-openfort` backend template.
- The external-wallet `Connectors` page moved to `@openfort/react/wagmi` and is now code-split, so embedded-wallet-only apps no longer load it.

**Added**

- 28 exported error classes with composed messages, `cause` traversal and a version footer.
- `@openfort/react/internal` entry point for store internals.
- `"use client"` on every client-only module, preserved through the build and guarded by tests.

**Fixed**

- A rejected email-verification link no longer reports success. The verification endpoint redirects to the same callback URL on failure with an `error` code appended, which `useAuthCallback` and the modal's verification page both ignored — so an expired or invalid link showed "email verified". Both now fail with the reason and strip `error` from the URL.
- Serialized embedded-signer work and credential transitions, so a stale session can no longer publish wallet, user or callback state after logout or a newer sign-in.
- Scoped query keys per client and endpoint, keeping credentialed RPC URLs out of the cache and preventing cross-account reuse.
- Restricted funding and onramp links to their expected HTTPS origins.
- Connected on the chain the application selected rather than the chain a restored account was recorded with.
- Fixed builds for consumers that do not install the optional `wagmi` peer.
- `@openfort/react/wagmi` no longer imports `@wagmi/core` and `@wagmi/connectors` directly, so it resolves under pnpm's isolated linker.
- Bounded every embedded-signer operation, so a request that never settles can no longer wedge signing for the rest of the session. Plain RPC reads (`eth_call`, `eth_getBalance`, …) bypass the signer queue entirely, and `eth_accounts` reports the current accounts instead of throwing once the pinned account goes stale.
- A transaction error now reports its real cause. `-32603` is the underlying SDK's catch-all wrapper, so insufficient gas no longer reads as "Network error", and contract rejections (`-32003`) are classified.
- `useBalance` reports `loading` rather than a successful `0` while a query is paused, so an offline app no longer shows an empty balance or blocks a send.
- The modal keeps a failed page load inside itself instead of letting the error reach the host application, and pages that are animating out are inert under React 19 as well as React 18.
- Solana SPL transfers refuse a recipient that is a token account (which would have burned the tokens), pick the token program from the mint so Token-2022 sends work, and honour `walletConfig.solana.commitment`.
- Wallet-asset reads use the RPC endpoint the application configured in wagmi before falling back to a public one.
- A failed `exportPrivateKey` or `setRecovery` reports the error without disconnecting a working wallet.
- A rejected wallet-recovery OTP can be retried immediately instead of replaying the rejected attempt.
- Password-reset links carry a correctly encoded address, so plus-addressed emails can complete a reset.
- Chain-switch failures other than EIP-1193 4902 surface an error instead of silently leaving the previous chain selected.

`create-openfort` scaffolds on Vite 8 with dependency ranges that satisfy the SDK peer ranges, and refuses to run on an unsupported Node.js version before touching the network or filesystem.
