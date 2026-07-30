---
'@openfort/react': patch
---

Pass `walletConfig.ethereum.rpcUrls` when the embedded Ethereum provider is built during wallet creation. The SDK memoizes the provider on its first caller, and during `create()` that caller is `useEthereumEmbeddedWallet` — `EthereumEmbeddedStrategy.initProvider`, the only path that supplied the endpoints, is gated on `EmbeddedState.READY`, which a wallet still being created hasn't reached. The session was therefore pinned to the SDK's public default endpoints, whose chain fallback is Base mainnet regardless of the configured chain, which showed up as intermittent `could not detect network` failures during wallet creation.
