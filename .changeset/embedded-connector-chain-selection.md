---
'@openfort/react': patch
---

The embedded wagmi connector now connects on the chain the application asked for instead of the chain the restored account happens to carry. Reloading a page restores the embedded account from storage with its own `chainId`, and the connector reported that chain back to wagmi — replacing the active chain, and in a test-key app it could land on a mainnet chain the application never selected. The connector moves the provider onto the requested chain and only ever reports a chain the provider is actually on, so wagmi and the signer can no longer disagree; if the account cannot be used there, the connection stays on the provider's chain rather than failing.
