---
'@openfort/react': patch
---

Align the funding client to the canonical `/v2/funding` contract: `/v2` paths, snake_case segments (`payment_methods`, `pay_link`), the chains endpoint at `/v2/funding/chains`, and `clientSecret` sent as a query param on the session GET (matching the API). Fixes the version/casing/transport drift between the SDK and the API.
