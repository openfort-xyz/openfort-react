---
"@openfort/react": patch
---

The asset inventory now shows default tokens at zero balance so it's never empty: the active chain's native token (ETH / POL / SOL / …) plus the stablecoins we ship verified addresses for (Base USDC; Solana USDC + USDT, cluster-aware). Held tokens are listed first. Tapping the connected balance opens the inventory directly instead of routing through the intermediate "No assets available" screen.
