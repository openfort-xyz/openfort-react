---
'@openfort/react': minor
---

Add one-tap mobile wallet deeplinks to the Deposit hub's "Transfer from wallet" step.

- Open-dApp universal links (MetaMask, Coinbase, Trust, Rainbow, Rabby, Phantom) open a hosted deposit send page in the wallet's in-app browser with the address, chain, token and amount prefilled.
- `uiConfig.funding.depositPageUrl` configures the send page; defaults to the Openfort-hosted `https://deposit.openfort.io`. Set it to self-host, or to an empty string to hide the deeplinks.
- Trust is hidden on iOS (no in-app dApp browser there).
- Replaces the raw `ethereum:` send-URI fallback, which only resolved for MetaMask.
