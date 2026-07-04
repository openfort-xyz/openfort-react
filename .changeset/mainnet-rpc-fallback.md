---
'@openfort/react': patch
---

Fall back to viem's public default RPCs for common mainnet chains (Ethereum, Base, Polygon, Optimism, Arbitrum, BNB, Beam) instead of throwing "No RPC URL configured". A one-time warning still nudges production apps toward `walletConfig.ethereum.rpcUrls`. Unknown chains without an explicit RPC keep throwing.
