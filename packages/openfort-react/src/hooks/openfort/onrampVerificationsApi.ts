import { getBackendUrl } from './onrampMethodsApi.js'

/**
 * Coinbase-issued OTP verification for native wallet pay (Apple/Google Pay),
 * proxied by the Openfort api. Coinbase sends and checks the code itself — no
 * per-project SMS vendor — and a completed verification stays valid 60 days;
 * its id rides the wallet-pay commit as `smsVerificationId`/`emailVerificationId`.
 *
 * Lives under the v2 funding namespace only (no legacy /v1/onramp alias).
 */
const VERIFICATIONS_API_BASE = '/v2/funding/onramp/verifications'

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
// 60-day reuse store — completed verifications are kept in localStorage so a
// repeat buyer doesn't re-verify on every purchase within Coinbase's validity
// window. The phone number / email is never written: an entry is keyed by the
// SHA-256 of `channel:destination`, so the store reveals nothing about the
// buyer if the storage is read, and a lookup for a different destination
// simply misses.
// ---------------------------------------------------------------------------

const STORE_KEY = 'openfort-onramp-verifications'

type StoredVerifications = Partial<
  Record<OnrampVerificationChannel, { destinationHash: string; verificationId: string; verificationExpiresAt?: string }>
>

function readStore(): StoredVerifications {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? '{}') as StoredVerifications
  } catch {
    return {}
  }
}

/** Hex SHA-256 of `channel:destination`, or null where WebCrypto is unavailable. */
async function destinationHash(channel: OnrampVerificationChannel, destination: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(`${channel}:${destination}`))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Persist a completed verification for reuse within its validity window. */
export async function storeOnrampVerification(
  channel: OnrampVerificationChannel,
  destination: string,
  record: OnrampVerificationRecord
): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const hash = await destinationHash(channel, destination)
    if (!hash) return
    const store = readStore()
    store[channel] = {
      destinationHash: hash,
      verificationId: record.verificationId,
      verificationExpiresAt: record.verificationExpiresAt,
    }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable (private mode) — the buyer just re-verifies next time.
  }
}

/** An unexpired stored verification id for this exact destination, or null. */
export async function storedOnrampVerification(
  channel: OnrampVerificationChannel,
  destination: string
): Promise<string | null> {
  const entry = readStore()[channel]
  if (!entry) return null
  if (entry.verificationExpiresAt && Date.parse(entry.verificationExpiresAt) <= Date.now()) return null
  const hash = await destinationHash(channel, destination)
  if (!hash || entry.destinationHash !== hash) return null
  return entry.verificationId
}
