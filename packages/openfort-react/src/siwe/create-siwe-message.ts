import { createSiweMessage } from 'viem/siwe'

const NONCE_RE = /^[A-Za-z0-9_-]{8,128}$/
const SIWE_EXPIRATION_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Creates a SIWE message for wallet auth. Uses current domain and origin.
 * Safe for SSR: returns undefined when window is not available.
 *
 * Hardened against replay by requiring a non-zero chainId and by pinning
 * `issuedAt` / `expirationTime` on the signed payload, even when the
 * backend nonce-store would otherwise catch a replay.
 *
 * @param address - Wallet address to sign
 * @param nonce - Server-provided nonce (must match `[A-Za-z0-9_-]{8,128}`)
 * @param chainId - Chain ID for the message (must be > 0)
 *
 * @example
 * ```tsx
 * const message = createSIWEMessage(address, nonce, chainId)
 * const signature = await signMessage({ message })
 * ```
 */
export const createSIWEMessage = (address: `0x${string}`, nonce: string, chainId: number) => {
  if (typeof window === 'undefined') return undefined
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error(`Invalid chainId for SIWE message: ${chainId}`)
  }
  if (typeof nonce !== 'string' || !NONCE_RE.test(nonce)) {
    throw new Error('Invalid SIWE nonce format')
  }
  const issuedAt = new Date()
  const expirationTime = new Date(issuedAt.getTime() + SIWE_EXPIRATION_MS)
  return createSiweMessage({
    domain: window.location.host,
    address,
    statement:
      'By signing, you are proving you own this wallet and logging in. This does not initiate a transaction or cost any fees.',
    uri: window.location.origin,
    version: '1',
    chainId,
    nonce,
    issuedAt,
    expirationTime,
  })
}
