---
'@openfort/react': minor
---

Source the Deposit chain/token pickers live from Relay instead of a hardcoded list.

`useFundingChains` fetches `GET /v1/funding/chains` (a passthrough of Relay's `/chains`) so the source chains and tokens always track what the rail actually supports — no more curated `sources.ts` registry. The CEX tab filters to EVM chains; selectors and the QR badge read logos straight from the chain/token data.
