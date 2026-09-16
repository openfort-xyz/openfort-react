---
'@openfort/react': patch
---

Fixed a login asking for the passkey twice. The provider's auto-recovery effect and the modal's recover page both recovered the same embedded account, and each call derived its own credential, so a passkey account answered two WebAuthn ceremonies to reach one signer. Either path now skips recovery when the signer already holds that account.
