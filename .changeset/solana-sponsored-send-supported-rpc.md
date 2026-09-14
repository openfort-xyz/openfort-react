---
"@openfort/react": patch
---

Fixed Solana sponsored sends, which failed with `Unknown method: transferTransaction` before broadcast. The paymaster method the send flow relied on is no longer routed by the Openfort Solana RPC endpoint, so `walletConfig.solana.sponsorFees` could not complete a transfer. The transfer instructions are now built client-side and submitted through `signAndSendTransaction`, which is the supported path.

Added `{ feeToken }` as a value for `walletConfig.solana.sponsorFees`, for projects whose gas sponsorship charges the end user in an SPL token instead of paying the fee for them. The fee payment instruction is quoted from the paymaster and appended to the transfer, and is rejected if it names an account outside that fee transfer.
