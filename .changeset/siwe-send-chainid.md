---
"@openfort/react": patch
---

Forward the connected wallet's `chainId` on the SIWE login flow. `useWalletAuth` and `useConnectWithSiwe` now pass `chainId` to `initSiwe` and `loginWithSiwe`, so the chain ID in the signed SIWE message matches what the backend verifies. Without it the backend defaulted the request chain ID to `1`, failing verification on any other chain with `UNAUTHORIZED_SIWE_MESSAGE_MISMATCH`. Requires `@openfort/openfort-js` with `chainId` support on `initSiwe`/`loginWithSiwe`.
