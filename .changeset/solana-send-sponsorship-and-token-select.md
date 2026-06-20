---
'@openfort/react': minor
---

Bring the Solana send flow to parity with EVM:

- **Config-driven fee sponsorship.** Added `walletConfig.solana.sponsorFees`, the SVM counterpart of `ethereum.ethereumFeeSponsorshipId`. When set, Solana sends are routed gaslessly through the Openfort paymaster and the confirm screen shows a "Sponsored" network-fee row. This replaces the per-transaction gasless toggle, which has been removed.
- **Token selection.** The Solana send screen now has a token picker (native SOL + SPL tokens such as USDC), matching the EVM ERC-20 send. SPL transfers are supported in both fee modes; the non-sponsored path creates the recipient's associated token account when needed.
