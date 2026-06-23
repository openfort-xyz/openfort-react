---
"@openfort/react": patch
---

Solana connected header: render the network indicator with the same pill button and tooltip as the EVM chain selector (single-network state) instead of a bespoke badge, so EVM and Solana headers stay visually consistent. The EVM `SwitchChainButton` is now a shared component. The cluster remains fixed by `walletConfig.solana`, so the Solana indicator stays read-only (no chevron or dropdown).
