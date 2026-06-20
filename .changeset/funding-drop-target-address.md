---
'@openfort/react': patch
---

Drop the `uiConfig.funding.targetAddress` override. Deposits always settle into the user's active embedded wallet (the address the SDK already resolves and sends to Relay as the recipient), so the override was a no-op on the deposit-address and CEX rails. `useFundingTarget` now returns `{ chain, currency }` and `FundingUIOptions` no longer accepts `targetAddress`.
