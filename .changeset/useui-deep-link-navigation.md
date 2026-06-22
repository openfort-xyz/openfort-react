---
"@openfort/react": minor
---

useUI: add deep-link navigation helpers (openSend, openReceive, openFunding, openBuy, openExportKey, openSettings) so callers can open a specific wallet screen directly. Each targets a connected-only screen and falls back to the login screen when the user is not connected.
