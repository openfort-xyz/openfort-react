---
'@openfort/react': patch
---

Fixed a login asking for the passkey twice. Recovery was requested from three independent places — the provider's auto-recovery effect, the modal's recover page, and the post-authentication connect path — and each decided for itself whether a recovery was still needed, at a different moment. `embeddedWallet.recover()` now has one owner that answers that question from the signer, so asking for an account the signer already holds is a no-op instead of a second WebAuthn ceremony, and no credential is built for a request that turns out to be unnecessary.
