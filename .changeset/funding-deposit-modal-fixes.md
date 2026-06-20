---
'@openfort/react': patch
---

Deposit hub fixes:

- Resolve the deposit recipient by the funding target's chain family, not the active chain type. A target/wallet family mismatch (e.g. an EVM session whose funding target is still Solana) previously sent an EVM address as the recipient for a Solana destination, which Relay rejected.
- Offer the destination chain itself as a source, so same-chain deposits (e.g. Solana → Solana) show as a plain transfer to the wallet address alongside the cross-chain bridge routes.
- Default the card / Apple Pay buy to USDC on EVM (matching Solana). The picker now lists buyable currencies (USDC, native) instead of the wallet's indexed balances, so a freshly created wallet no longer shows "No supported tokens found".
- Update Deposit method subtitles: "Bridge fee" (was "No fee") for the wallet/address rails, and a $5 minimum for the exchange rail.
