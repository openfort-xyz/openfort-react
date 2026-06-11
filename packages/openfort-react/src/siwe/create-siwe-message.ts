import { createSiweMessage } from 'viem/siwe'

/**
 * Creates a SIWE message for wallet auth. Uses current domain and origin.
 * Safe for SSR: returns undefined when window is not available.
 *
 * @param address - Wallet address to sign
 * @param nonce - Server-provided nonce
 * @param chainId - Chain ID for the message
 *
 * @example
 * ```tsx
 * const message = createSIWEMessage(address, nonce, chainId)
 * const signature = await signMessage({ message })
 * ```
 */
export const createSIWEMessage = (address: `0x${string}`, nonce: string, chainId: number) => {
  if (typeof window === 'undefined') return undefined
  return createSiweMessage({
    domain: window.location.host,
    address,
    statement:
      'By signing, you are proving you own this wallet and logging in. This does not initiate a transaction or cost any fees.',
    uri: window.location.origin,
    version: '1',
    chainId: chainId,
    nonce,
  })
}
