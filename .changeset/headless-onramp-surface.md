---
'@openfort/react': minor
---

Export the headless onramp surface: `useFundingClient`, `useOnrampQuote` + `totalFee`, `useResolvedFundingMethods`, `useFundingTarget`, `useFundingChains` + helpers, `createStripeOnrampCoordinator`, the OTP verification module, `backendMethodId`/`fetchOnrampMethods`, the EU step helpers, and the funding domain types. `useFundingClient` now adopts `openfort.funding` from `@openfort/openfort-js` all-or-nothing — the previous probe adopted a partial namespace and left `sessions.onrampCheckout` undefined. The onramp `PaymentMethodInput` declares the wallet-pay identity fields the commit already sent, plus the `angles` capability declaration threaded through `sessions.methods` and `sessions.quote`.
