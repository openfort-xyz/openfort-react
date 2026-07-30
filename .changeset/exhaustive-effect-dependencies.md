---
'@openfort/react': patch
---

Fix stale closures across hooks, providers and modal pages.

Email, OAuth and OTP sign-in built their verification callback URL from the modal's open flag as it stood when the callback was created, so a link mailed after the modal state changed pointed at the wrong destination; the same callbacks also ran post-auth wallet connection against an outdated wallet config. `useAuthCallback` now processes the URL callback when `enabled` flips from false to true instead of only on mount.

`useOpenfortCore().updateUser` signs the user out through the live implementation rather than a binding captured during provider setup. `LoadWallets` routes on the embedded wallet's current status and address. `PhoneOTP` links a number to an existing account instead of falling through to the sign-in path after a re-render. `PageContent` runs the back handler the page passed most recently, so a handler closing over changing state is no longer invoked with outdated values. `OTPInput` resets when its `length` changes and `QRCode` redraws when its embedded image changes.

The chain-select dropdown registers its scroll, resize and Escape handlers against the current `onClose`, so a changed handler is both invoked and unregistered correctly, and the modal's transition-block timer is now actually cancelled when a page swap interrupts it.
