---
'@openfort/react': patch
---

Adapt the Add funds → Card (fiat onramp) flow for Solana wallets: buy USDC (default) or SOL, resolve the onramp `destinationNetwork` to `solana`, seed the Solana card-buy with USDC, and link the Solana explorer on completion. EVM card-buy is unchanged.
