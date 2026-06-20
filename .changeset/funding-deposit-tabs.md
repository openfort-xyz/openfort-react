---
'@openfort/react': minor
---

Restructure the Deposit hub into three source-led tabs and add a destination-address override.

- **Transfer from wallet** (new) leads with prefilled wallet deeplinks; the deposit-address / QR path sits behind an off-by-default toggle.
- **Transfer from address** (renamed from "Transfer crypto") shows the cross-chain deposit address and QR.
- **Transfer from Exchange** leads with Coinbase / Binance pay links; the deposit-address path is behind the same toggle.
- `uiConfig.funding.targetAddress` overrides where deposits land (defaults to the active embedded wallet) — e.g. to fund a deployed smart account instead of its owner EOA.
