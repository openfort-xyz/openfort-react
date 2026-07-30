---
'@openfort/react': patch
---

Restructure the embedded-wallet internals behind an unchanged public API.

Wallet operations live in `src/actions` as pure, React-free functions that take an explicit client: `createEmbeddedWallet`, `importEmbeddedWallet`, `setActiveWallet`, `setRecoveryMethod`, `exportPrivateKey`, plus the account lookup and recovery-resolution helpers they share. Each throws the typed errors from `src/errors`; the hooks keep catching them and publishing an `error` status exactly as before, and they are unit-tested directly against a mocked client.

`useEthereumEmbeddedWallet` and `useSolanaEmbeddedWallet` are now thin adapters over a shared factory that owns the store subscriptions, status state, action callbacks and result shape. Each chain supplies only what differs: provider construction, address comparison (case-insensitive on EVM, exact on Solana), wallet shapes, its account request, and its own sync effect. Ethereum's inlined recovery decision tree is replaced by the shared resolver both chains already agreed on.

The Stripe and Coinbase onramp modules share one request helper, so a failed session returns the same `ApiRequestError` with the backend status and message whichever provider was used.
