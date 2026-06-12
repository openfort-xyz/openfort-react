---
"@openfort/react": patch
---

Prevent SendConfirmation from submitting a duplicate transaction: the confirm button is now disabled and `handleConfirm` is guarded once a transaction is in flight, and a provider error is reliably shown in the error UI.
