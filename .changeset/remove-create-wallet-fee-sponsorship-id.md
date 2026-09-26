---
'@openfort/react': patch
---

Removed the `feeSponsorshipId` option from `CreateEmbeddedWalletOptions` (and so from `ImportEmbeddedWalletOptions`). The SDK never read it: creating a wallet ignored the value. Gas sponsorship is configured per chain on the provider through `walletConfig.ethereum.ethereumFeeSponsorshipId`. Code that still passes the option gets a type error and should delete it; runtime behaviour is unchanged.
