---
"@openfort/react": minor
---

Standardize the send confirmation screen across EVM and Solana with a shared approval-style preview (Total / To / Network / Estimated fee + a "Pay with" card; sponsored sends show a gasless fee). `useUI().openSend(tx)` now accepts a prepared transaction (`{ to, amount, asset? }`) and jumps straight to that preview, skipping asset/amount/recipient entry; `openSend()` with no arguments still opens the full send flow.
