/**
 * Base path for the fiat-onramp API (`methods` preview).
 *
 * The onramp is consolidated under the v2 funding namespace
 * (`/v2/funding/onramp/*`); the `/v1/onramp/*` alias no longer serves
 * `/methods`, so this widget release requires the v2 api.
 */
export const ONRAMP_API_BASE = '/v2/funding/onramp'
