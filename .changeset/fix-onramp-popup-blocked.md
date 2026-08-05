---
"@openfort/react": patch
---

Fix "Failed to create payment session" when buying with card on Safari. The onramp popup was opened after the session request resolved, by which point the browser's transient user activation had expired — Safari blocks `window.open` after ~0.5s — so a successfully created session was reported as a payment failure. The provider window is now reserved synchronously inside the Continue click and navigated once the session resolves. If the browser still refuses the window, a "Popup blocked" screen offers a click-through instead of a false error.
