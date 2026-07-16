---
"@openfort/react": minor
---

Add a typed analytics sink for the funding-session rail (crypto/wallet/exchange deposits). The SDK bundles no analytics vendor — wire `uiConfig.funding.onEvent` (or `useFunding({ onEvent })`) and forward the typed `FundingAnalyticsEvent`s to PostHog or any backend. Emits the full session lifecycle at the existing internal breadcrumb points: `funding_route_selected`, `funding_session_created`, `funding_payment_method_set`, `funding_address_copied`, `funding_status_changed`, `funding_succeeded` / `funding_bounced` / `funding_expired`, `funding_session_abandoned`, and `funding_session_error`. Event names and enums (`SessionStatus`, `PaymentMethodType`) mirror the SDK's own vocabulary so dashboards map 1:1 to code. No-op when no sink is configured; a throwing handler can never break the deposit flow.
