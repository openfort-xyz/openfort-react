---
"@openfort/react": minor
---

Added fiat onramp methods to the funding flow. The Add funds hub now lists the card, bank transfer, Apple Pay and Google Pay rails Openfort resolves for the buyer's region and destination, prices them with a live quote, and commits them as an `onramp` payment method on the same funding session as the crypto rails. Added the `useFundingMethods` and `useOnramp` hooks, the `cryptoPaymentMethod` helper, and the `OnrampMethodId`, `OnrampAngle`, `OnrampPaymentMethod`, `CryptoPaymentMethod`, `OnrampQuote`, `ResolvedFundingMethod` and `ResolvedFundingMethods` types. Added the Coinbase native wallet-pay flow (OTP-verified contact capture, in-page Pay button, spending-limit upgrade) and the Stripe Link element checkout, and the `uiConfig.funding.country` override for region routing.
