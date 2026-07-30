---
'@openfort/react': minor
---

Adopt TanStack Query for every data hook and converge the hook return shapes.

`@tanstack/react-query` (`>=5.0.0`) is now a required peer dependency. Apps using the `@openfort/react/wagmi` entry already have it — wagmi 3 requires it — and need no change. Headless apps must add it: `pnpm add @tanstack/react-query`. Providing a `QueryClientProvider` is optional: `OpenfortProvider` uses the app's `QueryClient` when one is in scope so Openfort's queries share the app's cache and respond to its `invalidateQueries`, and creates one of its own only when none is present.

The in-house `useAsyncData` cache is gone. Balances, wallet assets, ENS identity and funding chains are now real queries keyed through `openfortKeys`, so they participate in normal TanStack caching, deduplication, refetching and devtools. `openfortKeys.user()` and `openfortKeys.embeddedAccounts()` hold the same user and account list the provider works with, so `useQuery(getUserQueryOptions(client))` and `useQuery(getEmbeddedAccountsQueryOptions(client))` read the SDK's data instead of a second copy. Signing out clears every cached Openfort query.

Public API changes:

- `invalidateBalance()` is replaced by the `useInvalidateBalance()` hook, which returns a callback that invalidates the balance and wallet-asset queries on the query client in scope. The `openfort:balance-invalidate` window event it used to dispatch is gone.
- `openfortKeys` key factories take a single parameters object and, for the parameterised families (`balance`, `walletAssets`, `identity`, `fundingChains`), also accept no argument to produce the family prefix for `invalidateQueries`. `openfortKeys.walletAssets(chainId, assets, address)` becomes `openfortKeys.walletAssets({ address, chainType, multiChain, chainId, assets })`.
- `useEthereumWalletAssets()` returns the full TanStack query result — including `isPending`, `isFetching`, `status`, `refetch` and `queryKey` — alongside the existing `data` (still `null` before the first result), `error` (still an `OpenfortError`), `isIdle` and `multiChain` fields.
- `useSolanaWalletAssets()` returns the same shape, gaining `isPending`, `isFetching`, `status`, `isIdle`, `error` and `queryKey`.
- `useFundingChains()` renames `loading` to `isLoading` and adds `isFetching`, `refetch` and `queryKey`.
- `OpenfortHookOptions.throwOnError` is removed. Action hooks now have a single protocol: callbacks run, and the call resolves to `{ error }` on failure instead of rejecting. Call sites that relied on `throwOnError: true` should branch on the resolved `error` instead.
- `isAuthenticated` has one definition, shared by `useUser()` and the `selectIsAuthenticated` store selector: true for every embedded state after sign-in, including `CREATING_ACCOUNT`. `selectIsAuthenticated` previously reported false while the embedded account was being created, which flipped the flag off and back on mid-signup. Use `useUser().isConnected` for "signed in and the wallet is ready".
