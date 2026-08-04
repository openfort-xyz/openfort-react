---
'@openfort/react': patch
---

Fixed the reset-password screen, which accepted a new password but never submitted it. It now sends the password with the token from the reset link, signs the user in, and shows an error message when the link is invalid, expired, or the reset is rejected.

Fixed `logger.error` and `logger.warn` being swallowed unless `debugMode` was enabled. Warnings and errors from the SDK now always reach the console; `logger.log` stays behind `debugMode`. OAuth callback and wallet-loading failures no longer print access-token fragments or full user objects. Structured and serialized credentials, including authorization headers, cookies, and credential-bearing URLs, are recursively redacted before any SDK log reaches the console.

OAuth credentials are now removed from the address bar before callback processing continues, reset submissions are guarded against synchronous duplicate requests, and RPC path credentials under versioned key endpoints are redacted from diagnostics.
