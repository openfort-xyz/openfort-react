import { SDKConfiguration } from '@openfort/openfort-js'

/**
 * Coinbase-issued OTP verification for native wallet pay (Apple/Google Pay),
 * proxied by the Openfort api. Coinbase sends and checks the code itself — no
 * per-project SMS vendor — and a completed verification stays valid 60 days;
 * its id rides the wallet-pay commit as `smsVerificationId`/`emailVerificationId`.
 *
 * Lives under the v2 funding namespace only (no legacy /v1/onramp alias).
 */
const VERIFICATIONS_API_BASE = '/v2/funding/onramp/verifications'

const getBackendUrl = (): string => {
  const sdkConfig = SDKConfiguration.getInstance()
  return sdkConfig?.backendUrl || 'https://api.openfort.io'
}

export type OnrampVerificationChannel = 'sms' | 'email'

export type OnrampVerificationStart = {
  verificationId: string
  /** ISO-8601 — the OTP expires ~10 minutes after initiation. */
  otpExpiresAt?: string
}

export type OnrampVerificationRecord = {
  verificationId: string
  /** ISO-8601 — the verification stays valid ~60 days. */
  verificationExpiresAt?: string
}

async function post<T>(path: string, publishableKey: string, body: unknown): Promise<T> {
  const response = await fetch(`${getBackendUrl()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${publishableKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => null)) as (T & { error?: { message?: string } }) | null
  if (!response.ok || !data) {
    throw new Error(data?.error?.message ?? 'Verification request failed. Try again.')
  }
  return data
}

/** Start a verification — Coinbase sends the OTP to the destination. */
export function startOnrampVerification(params: {
  channel: OnrampVerificationChannel
  destination: string
  publishableKey: string
}): Promise<OnrampVerificationStart> {
  return post(VERIFICATIONS_API_BASE, params.publishableKey, {
    channel: params.channel,
    destination: params.destination,
  })
}

/** Submit the OTP the buyer received; on success the verification is order-ready. */
export function submitOnrampVerification(params: {
  verificationId: string
  otpCode: string
  publishableKey: string
}): Promise<OnrampVerificationRecord> {
  return post(`${VERIFICATIONS_API_BASE}/${encodeURIComponent(params.verificationId)}/submit`, params.publishableKey, {
    otpCode: params.otpCode,
  })
}

// ---------------------------------------------------------------------------
// 60-day reuse store — completed verifications are keyed by channel +
// destination in localStorage so a repeat buyer doesn't re-verify on every
// purchase within Coinbase's validity window.
// ---------------------------------------------------------------------------

const STORE_KEY = 'openfort-onramp-verifications'

type StoredVerifications = Partial<
  Record<OnrampVerificationChannel, { destination: string; verificationId: string; verificationExpiresAt?: string }>
>

function readStore(): StoredVerifications {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '{}') as StoredVerifications
  } catch {
    return {}
  }
}

/** Persist a completed verification for reuse within its validity window. */
export function storeOnrampVerification(
  channel: OnrampVerificationChannel,
  destination: string,
  record: OnrampVerificationRecord
): void {
  if (typeof window === 'undefined') return
  try {
    const store = readStore()
    store[channel] = { destination, ...record }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable (private mode) — the buyer just re-verifies next time.
  }
}

/** An unexpired stored verification id for this exact destination, or null. */
export function storedOnrampVerification(channel: OnrampVerificationChannel, destination: string): string | null {
  const entry = readStore()[channel]
  if (!entry || entry.destination !== destination) return null
  if (entry.verificationExpiresAt && Date.parse(entry.verificationExpiresAt) <= Date.now()) return null
  return entry.verificationId
}
