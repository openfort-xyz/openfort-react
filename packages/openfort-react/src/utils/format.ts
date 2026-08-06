/**
 * Format Utilities
 *
 * Address formatting utilities for different chain types.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'

/**
 * Shortens `address` to its leading and trailing characters.
 *
 * `minLength` stops a string too short to shorten coming back with more
 * characters elided than it had. Each caller keeps the threshold and leading run
 * it shipped with, because those differ per chain.
 */
function truncate(address: string, lead: number, separator: string, minLength: number): string {
  if (address.length < minLength) return address
  return `${address.slice(0, lead)}${separator}${address.slice(-4)}`
}

/** Truncate EVM address with a configurable separator: `0x1234••••abcd`. */
export function truncateEthAddress(address?: string, separator = '••••'): string {
  if (!address) return ''
  return truncate(address, 6, separator, 11)
}

/** Truncate Solana address with a configurable separator: `ABC123••••XYZ9`. */
export function truncateSolanaAddress(address?: string, separator = '••••'): string {
  if (!address) return ''
  return truncate(address, 6, separator, 15)
}

const addressFormatters: Record<ChainTypeEnum, (address: string) => string> = {
  /** `0x1234...abcd` */
  [ChainTypeEnum.EVM]: (address) => truncate(address, 6, '...', 10),
  /** `ABC1...XYZ9` */
  [ChainTypeEnum.SVM]: (address) => truncate(address, 4, '...', 8),
}

/**
 * Format address based on chain type
 */
export function formatAddress(address: string, chainType: ChainTypeEnum): string {
  return addressFormatters[chainType](address)
}
