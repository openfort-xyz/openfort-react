---
'@openfort/react': minor
---

Make Deposit funding methods configurable, like `authProviders`.

New `uiConfig.funding.methods` (a `FundingMethod[]`) chooses which methods the Deposit hub shows and in what order — `APPLE_PAY`, `CARD`, `WALLET`, `ADDRESS`, `EXCHANGE`. Omit it for the current default (all available, Apple Pay first on mobile). Device, region, and backend-availability gating still apply. `FundingMethod` is exported from the package root.
