---
"@openfort/react": patch
---

Fix `personal_sign` failing with "personal_sign requires the signer to be the from address" when a user has multiple embedded smart accounts. The Sign Message modal now derives the `from` address from the provider's active account (via `eth_accounts`) instead of the hook's cached address, and `useEthereumEmbeddedWallet` reconciles its active wallet to the provider's real signing account so the displayed wallet and the actual signer always agree.
