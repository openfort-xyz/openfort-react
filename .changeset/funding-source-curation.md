---
'@openfort/react': minor
---

Curate Deposit source chains/currencies, and standardize on "currency".

The Deposit pickers now show a curated subset of the rail's chains/currencies instead of everything. Defaults: a common set of source chains (Arbitrum, Base, BNB, Ethereum, Monad, Optimism, Polygon, Solana) and currencies (`['native', 'USDC', 'USDT']`, where `'native'` matches each chain's native asset). Override via `uiConfig.funding.sourceChains` (CAIP-2 allowlist + order) and `uiConfig.funding.sourceCurrencies` (symbol allowlist; `'native'` sentinel). Selections the rail doesn't route are skipped.

Vocabulary is now "currency" throughout (`FundingCurrency`, `chain.currencies`, the picker label) to match the rail and the destination shape, replacing "token".
