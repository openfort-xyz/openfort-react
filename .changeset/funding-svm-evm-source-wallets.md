---
'@openfort/react': patch
---

Fix the empty wallet list in "Transfer from wallet" for EVM sources when the active wallet is Solana-only. In Solana mode there's no wagmi bridge, so the desktop browser-extension send (`DepositWalletDesktop`) renders nothing — no wallet was offered for an EVM source. The hub now falls back to the open-dApp deeplinks (MetaMask, Phantom, …) whenever the wagmi bridge is absent, matching the mobile and same-chain Solana paths.
