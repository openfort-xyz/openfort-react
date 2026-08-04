---
'@openfort/react': major
---

Adopted TanStack Query for every data hook and converged the hook return shapes.

`@tanstack/react-query` (`>=5.99.2 <6`) is now a required peer dependency. Apps using the `@openfort/react/wagmi` entry already have TanStack Query because wagmi 3 requires it, but must ensure their installed version satisfies this range. Headless apps must add it: `pnpm add @tanstack/react-query@">=5.99.2 <6"`. Providing a `QueryClientProvider` is optional: `OpenfortProvider` uses the app's `QueryClient` when one is in scope so Openfort's queries share the app's cache and respond to its `invalidateQueries`, and creates one of its own only when none is present.

The in-house `useAsyncData` cache is gone. Balances, wallet assets, ENS identity and funding chains are now real queries keyed through `openfortKeys`, so they participate in normal TanStack caching, deduplication, refetching and devtools. `openfortKeys.user()` and `openfortKeys.embeddedAccounts()` hold the same user and account list the provider works with, so `useQuery(getUserQueryOptions(client))` and `useQuery(getEmbeddedAccountsQueryOptions(client))` read the SDK's data instead of a second copy. Signing out clears the departing client's authenticated and account-derived entries.

Public API changes:

- `invalidateBalance()` is replaced by the `useInvalidateBalance()` hook, which returns a callback that invalidates the balance and wallet-asset queries on the query client in scope. The `openfort:balance-invalidate` window event it used to dispatch is gone.
- `openfortKeys` key factories take a single parameters object and parameterised families also accept no argument to produce the family prefix for `invalidateQueries`. `openfortKeys.walletAssets(chainId, assets, address)` becomes `openfortKeys.walletAssets({ address, chainType, multiChain, chainId, assets })`.
- `useEthereumWalletAssets()` returns the full TanStack query result — including `isPending`, `isFetching`, `status`, `refetch` and `queryKey` — alongside the existing `data` (still `null` before the first result), `error` (still an `OpenfortError`), `isIdle` and `multiChain` fields.
- `useSolanaWalletAssets()` returns the same shape, gaining `isPending`, `isFetching`, `status`, `isIdle`, `error` and `queryKey`. Its `error` is normalized to an `OpenfortError`, matching the other public data hooks.
- `useFundingChains()` renames `loading` to `isLoading` and adds `isFetching`, `refetch` and `queryKey`.
- `OpenfortHookOptions.throwOnError` is removed. Action hooks now have a single protocol: callbacks run, and the call resolves to `{ error }` on failure instead of rejecting. `useFunding()` session and pay-link actions and `useSignMessage()` modal requests follow this protocol for operational failures, cancellation, and request supersession. Synchronous callback exceptions and asynchronous callback rejections are logged without changing that result or preventing another callback from running. Call sites that relied on `throwOnError: true` should branch on the resolved `error` instead.
- `isAuthenticated` has one definition, shared by `useUser()` and the `selectIsAuthenticated` store selector: true for every embedded state after sign-in, including `CREATING_ACCOUNT`. `selectIsAuthenticated` previously reported false while the embedded account was being created, which flipped the flag off and back on mid-signup. Use `useUser().isConnected` for "signed in and the wallet is ready".

Authenticated user, embedded-account, native-balance and wallet-asset entries are scoped to their Openfort client when the host supplies a shared `QueryClient`. Native-balance, wallet-asset, and funding-chain keys include opaque scopes for their effective endpoints, so requests with different transports cannot reuse each other's data without exposing credentialed URLs in the cache. Solana balance keys also include the requested commitment. Signing out removes the departing client's account-derived entries without disturbing another Openfort provider's data.

Missing runtime wallet-asset entries are ignored during request and cache-key construction instead of crashing the connected modal. Funding and onramp links returned by a backend are restricted to the expected Coinbase or Stripe HTTPS origin before they can be opened.

Network-fee and identity queries use the same deterministic, non-plaintext endpoint fingerprints. Credentialed RPC URLs therefore stay out of shared, dehydrated and persisted query keys.
