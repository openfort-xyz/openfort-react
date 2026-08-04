---
'@openfort/react': patch
---

Honoured `walletConfig.ethereum.rpcUrls` for the embedded signer's per-chain RPC endpoints in wagmi mode. An explicitly configured URL takes precedence over the wagmi transport URL for that chain; chains without a configured entry keep using the transport URL. The signer resolves these endpoints from its own context, so an app can point its in-browser transports at one node (a local fork, a private gateway) while keeping the signer on endpoints reachable from anywhere.
