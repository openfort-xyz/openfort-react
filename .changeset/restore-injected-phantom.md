---
'@openfort/react': patch
---

Restore targeted injected connectors in the default wagmi connectors so browser-extension wallets surface individually.

`getDefaultConnectors` now adds `injected({ target: 'metaMask' })` and `injected({ target: 'phantom' })` instead of relying on a single generic injected provider. Phantom reappears in the Deposit hub's "Transfer from wallet" extension list (regressed in an earlier merge).
