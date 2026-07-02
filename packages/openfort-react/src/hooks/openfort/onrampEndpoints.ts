/**
 * Base path for the fiat-onramp API: `methods`, `quotes` and `sessions`.
 *
 * The onramp is being consolidated under the v2 funding namespace
 * (`/v2/funding/onramp/*`). `/v1/onramp/*` stays as a deprecated alias so
 * already-shipped SDKs keep working. This stays on v1 until the v2 routes are
 * live in prod, then flips here in one place.
 */
export const ONRAMP_API_BASE = '/v1/onramp'
