---
"@openfort/react": minor
---

Wallet UI improvements:

- Send: redesigned to two fields — recipient and an amount field with an inline token selector showing the asset and chain logos; renamed "Send assets" → "Send money".
- Receive: renamed "Receive funds" → "Receive money" and removed the redundant description.
- Token pickers (EVM + Solana) and the Solana asset inventory now show the token logo with a chain badge.
- Sign message screen: the body scrolls within the modal with the action pinned (mobile), no longer rejects spuriously under React StrictMode, and now works on Solana (signs via the Solana embedded wallet).
- Export private key: revealing now requires a 5s press-and-hold and shows the full key in a copy field.
- Transfer-from-wallet: the wallet list collapses to three with a "Show more" toggle.
- The modal now auto-fits its content on every page via a ResizeObserver, so screens size correctly without manual resize calls.
- `useUI`: `openSend`/`openReceive` route to the Solana screens when on Solana.
- Confirm transfer preview (EVM + Solana): Network shows the chain logo + name (not the chain id); the EVM estimated fee reads from the RPC and, when sponsored, shows the would-be fee struck through next to "Sponsored"; "Pay with" shows the wallet address and its current balance; the action buttons sit in two columns.
