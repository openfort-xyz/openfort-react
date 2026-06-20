---
'@openfort/react': patch
---

Show Phantom in "Transfer from wallet" for Solana sources. Solana sources have no numeric chain id and no desktop EVM-extension send, so they previously rendered no wallets at all. The deposit deeplink is now VM-aware (`buildDepositPageUrl` emits `vm=svm` with the SPL mint and base58 recipient instead of a numeric `chainId`), and Solana sources route through the deeplink (Phantom) on every platform. Pairs with the deposit page's new Solana Pay path.
