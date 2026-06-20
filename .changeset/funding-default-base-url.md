---
'@openfort/react': patch
---

Default `uiConfig.fundingBaseUrl` to the SDK's backend URL (`api.openfort.io`). The Deposit hub's crypto rails (`useFunding`, `useFundingChains`) previously required `fundingBaseUrl` to be set or they stayed hidden, while the CEX rail already fell back to the backend — an inconsistency. Both now resolve to `uiConfig.fundingBaseUrl || backendUrl`, so the funding rails work out of the box; set `fundingBaseUrl` only to point at a custom funding service.
