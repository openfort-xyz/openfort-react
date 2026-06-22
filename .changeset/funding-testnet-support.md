---
"@openfort/react": minor
---

Add testnet funding support: the deposit flow now uses Relay's testnet rail for
`pk_test_…` keys (native ETH on Base Sepolia / Sepolia), explains testnet limits,
disables unsupported rails, detects same-chain arrivals, and shows testnet native
balances. Also fixes chain/currency logos and the explorer link.
