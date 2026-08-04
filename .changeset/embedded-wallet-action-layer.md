---
'@openfort/react': major
---

Restructured the embedded-wallet internals behind shared, typed action functions.

Wallet operations were moved to `src/actions` as pure, React-free functions that take an explicit client: `createEmbeddedWallet`, `importEmbeddedWallet`, `setActiveWallet`, `setRecoveryMethod`, `exportPrivateKey`, plus their shared account and recovery helpers. Actions throw typed errors from `src/errors`; hook boundaries catch them, update hook state, run `onError`, and resolve a discriminated result instead of rejecting.

`useEthereumEmbeddedWallet` and `useSolanaEmbeddedWallet` became thin adapters over a shared factory. Create/import now resolve `{ account } | { error }`; activation resolves `{ needsRecovery } | { error }`; recovery resolves `{}` or `{ error }`; private-key export resolves `{ privateKey } | { error }`. Consumers must branch on `error` before advancing a success flow.

The Stripe and Coinbase onramp modules were consolidated on one request helper, so both surface the same `ApiRequestError` shape with the backend status and message.

Embedded signer replacement and provider synchronization were serialized per Openfort client. Explicit password recovery now republishes signer readiness, stale automatic-recovery attempts yield to the latest wallet, consumer callback failures no longer change action results, recovery endpoint requests time out with typed errors, and a failed post-create account refresh no longer reports an already-created wallet as failed.

Queued embedded-signer work was prevented from starting when the authenticated session ended, and results from work already in progress were suppressed after session invalidation. Unauthenticated transitions now clear account-derived store and query state. Recovery and export operations were bound to the requested chain and account. `useGrantPermissions` now rejects missing connector identities instead of routing them through the embedded signer, and `use7702Authorization` now follows the non-throwing action-hook result contract with a stable action reference.

Wallet creation, import, and activation now share a client-wide latest-request publication guard, so an older successful request can return its result without replacing the wallet selected by a newer request from another hook instance. Post-auth wallet setup now captures the authenticated wallet session before account and recovery preparation. Credential-establishing flows and logout now share a client-wide transition queue: mutations run in request order while only the latest transition may publish user, wallet, status, or callback state. Authenticated link and unlink mutations are serialized against those transitions without changing the active principal. SIWE reserves ownership before wallet preparation begins, and consumer callback failures cannot change the action result. Stale setup can no longer publish or sign out a replacement session after logout, direct credential replacement, or an SDK unauthenticated transition.
