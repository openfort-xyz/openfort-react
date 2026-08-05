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
- `openfortKeys` factories take a single parameters object, except `user(scope?)` and `embeddedAccounts(scope?)`, which still take a positional string. `useEthereumWalletAssets` and `useSolanaWalletAssets` return the full TanStack query result, renaming `loading` to `isLoading`.
- Removed the `OpenfortReactErrorType` enum, its `OpenfortErrorType` alias and the `type` field on every error. Narrow with `instanceof` or `error.name` against the exported error classes instead — `error.type === OpenfortErrorType.WALLET_ERROR` becomes `error instanceof WalletError`.
- Store internals (`StoreContext`, `OpenfortStore`, `OpenfortStoreState` and the `select*` selectors) are only available from `@openfort/react/internal`; the root re-exports are gone.
- Removed the `useOpenfortCore` alias (use `useOpenfort`), the `wallets` alias in `@openfort/react/wagmi` (use `getDefaultConnectors`), the no-op `setDefaultClient()` and the ignored `sessionKey` option on `useGrantPermissions`.
- `useSignMessage` and `use7702Authorization` resolve instead of rejecting. `signMessage`/`signTypedData` return `{ signature } | { error }` and `signAuthorization` returns a `{ status }` result, so a dismissed prompt no longer rejects — branch on the result rather than relying on `try`/`catch`.
- Removed `OpenfortError.data`. The replacement fields are `shortMessage`, `details`, `metaMessages` and `cause`.
- `logger.warn` and `logger.error` always emit, regardless of `debugMode`. Only `logger.log` remains gated. Credentials are redacted from anything logged and from anything composed into an error message, matched by key name, by header shape and by JWT shape. An `Error` keeps its message and stack when logged.
- `getDefaultConfig` sets wagmi's `ssr: true`, so `useAccount()` reports `reconnecting` on the first render instead of `connected`. Gate on `isConnected === false && status !== 'reconnecting'` before showing a signed-out view.
- `setEmbeddedWalletProvider` (`@openfort/react/wagmi`) takes the Openfort client as a second argument.
- `@wagmi/core` is a new optional peer dependency, installed automatically alongside `wagmi`.
- `walletConfig.createEncryptedSessionEndpoint` now receives an `Authorization: Bearer <access token>` header. Endpoints that reject unknown headers, or that were relying on being callable anonymously, need updating — see the hardened `create-openfort` backend template.
- The external-wallet `Connectors` page moved to `@openfort/react/wagmi` and is now code-split, so embedded-wallet-only apps no longer load it.
- Calls that were previously accepted are now rejected, because each could produce an unrecoverable result:
  - `useGrantPermissions` refuses an empty `permissions` array. An empty whitelist disables the destination check server-side, so the session key could call any contract. List the calls the key may make.
  - `useGrantPermissions` refuses an `expiry` above ten years. `expiry` is a duration in seconds, not a timestamp; passing a timestamp produced a key valid for decades.
  - `use7702Authorization` refuses `chainId: 0`, which authorises the delegation on every EIP-7702 chain permanently. Pass `allowAllChains` if that is genuinely intended.
  - `signTypedData` checks `domain.chainId` against the connected chain, so a payload for another chain no longer signs silently.
  - Solana transfers refuse a recipient owned by a token program — a mint or a token account — on native and SPL, sponsored and unsponsored.
  - A second `grantPermissions` or `revokePermissions` while the first is in flight resolves with an error instead of granting twice.

**Added**

- 29 exported error classes with composed messages, `cause` traversal and a version footer. Compare against `error.shortMessage`, not `error.message`: the message carries the version footer, so matching on it breaks on every upgrade.
- `useAuthCallback`'s `verifyEmail` result carries `confirmed`. It is `true` when the SDK exchanged a state token and `false` when the callback carried none — the endpoint signals success by the absence of an `error` parameter, which anyone able to open the URL can reproduce. Re-check server-side before granting anything on a `false` result.
- `@openfort/react/internal` entry point for store internals.
- `"use client"` on every client-only module, preserved through the build and guarded by tests.

**Fixed**

- A rejected email-verification link no longer reports success. The verification endpoint redirects to the same callback URL on failure with an `error` code appended, which `useAuthCallback` and the modal's verification page both ignored — so an expired or invalid link showed "email verified". Both now fail with the reason and strip `error` from the URL.
- Serialized embedded-signer work and credential transitions, so a stale session can no longer publish wallet, user or callback state after logout or a newer sign-in. Operations reserved before a credential transition are invalidated and cannot start; an operation that has already begun is stopped at its next checkpoint rather than mid-flight.
- Scoped query keys per client and endpoint, keeping credentialed RPC URLs out of the cache and preventing cross-account reuse.
- Restricted funding and onramp links to their expected HTTPS origins.
- Connected on the chain the application selected rather than the chain a restored account was recorded with.
- Fixed builds for consumers that do not install the optional `wagmi` peer.
- `@openfort/react/wagmi` no longer imports `@wagmi/core` and `@wagmi/connectors` directly, so it resolves under pnpm's isolated linker.
- Bounded every embedded-signer operation *and* the credential-transition barrier they queue behind, so neither a request nor a sign-in prompt that never settles can wedge signing for the rest of the session. A timed-out operation is also barred from publishing once the queue has moved on. Plain RPC reads (`eth_call`, `eth_getBalance`, …) bypass the signer queue entirely, and `eth_accounts` reports the current accounts instead of throwing once the pinned account goes stale.
- A transaction error now reports its real cause. `-32603` and `-32000` are catch-all wrappers, so the message is consulted before either code: insufficient funds, contract reverts, nonce conflicts and gas failures are each classified instead of reading as "Network error" or "Transaction would fail". A wrapper's code no longer hides a specific one nested in `cause` or `data`, so a user cancellation is reported as a cancellation.
- `useBalance` reports `loading` rather than a successful `0` while a query is paused, so an offline app no longer shows an empty balance or blocks a send. A failed background refetch no longer discards a balance already known to be good, so the send screen keeps blocking an over-balance amount.
- The modal keeps a failed page load inside itself instead of letting the error reach the host application, and pages that are animating out are inert under React 19 as well as React 18.
- Wallet-asset reads use the RPC endpoint the application configured in wagmi before falling back to a public one.
- Solana SPL transfers refuse a recipient that is a token account, on both the normal and the fee-sponsored path, pick the token program from the mint so Token-2022 sends work, and honour `walletConfig.solana.commitment`.
- A failed `exportPrivateKey` or `setRecovery` reports the error without disconnecting a working wallet.
- A rejected wallet-recovery OTP is cleared and the failure shown, on both the wallet-creation and the recovery screen, so the next code can be typed straight away instead of replaying the rejected attempt. A failed recovery now offers a retry rather than only a way back.
- Password-reset links carry a correctly encoded address, so plus-addressed emails can complete a reset.
- Chain-switch failures surface an error instead of silently leaving the previous chain selected. Declining the wallet prompt (EIP-1193 4001) is treated as a choice, not a failure, and 4902 still triggers the add-chain path.
- Action functions keep a stable identity across renders even when the hook is given an inline options object, so an effect depending on one no longer re-fires on every render.
- `use7702Authorization` accepts the delegate as `address` as well as `contractAddress`, so `signAuthorization(await prepareAuthorization(...))` works as viem documents it.
- The modal contains a failure in any page, not only the code-split ones, and offers a reload when a page's chunk cannot be fetched — the usual cause being a deploy while the tab was open.
- Wallet deep links supplied by the funding service are restricted to https.

`create-openfort` scaffolds on Vite 8 with dependency ranges that satisfy the SDK peer ranges, and refuses to run on an unsupported Node.js version before touching the network or filesystem. It also rejects a project name containing `..` or given as an absolute path, and an unrecognised `--template`, each of which previously wrote outside the working directory.

**Known issues**

Found during review of this release and not yet fixed.

- A chain absent from the SDK's known-chain list falls back to a Sepolia endpoint and reports the result as that chain's balance. Set `walletConfig.ethereum.rpcUrls` for any chain outside the common set.
