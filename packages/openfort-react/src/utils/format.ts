/**
 * Format Utilities
 *
 * Address formatting utilities for different chain types.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'

const EVM_TRUNCATE_REGEX = /^(0x[a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/

/**
 * Format EVM address: 0x1234...abcd
 */
function formatEVMAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Format Solana address: ABC1...XYZ9
 */
function formatSolanaAddress(address: string): string {
  if (!address || address.length < 8) return address
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

/**
 * Truncate EVM address with configurable separator (regex-based for 0x format).
 */
export function truncateEthAddress(address?: string, separator = '••••'): string {
  if (!address) return ''
  const match = address.match(EVM_TRUNCATE_REGEX)
  if (!match) return address
  return `${match[1]}${separator}${match[2]}`
}

/**
 * Truncate Solana address with configurable separator.
 */
export function truncateSolanaAddress(address?: string, separator = '••••'): string {
  if (!address) return ''
  if (address.length <= 14) return address
  return `${address.slice(0, 6)}${separator}${address.slice(-4)}`
}

const addressFormatters: Record<ChainTypeEnum, (address: string) => string> = {
  [ChainTypeEnum.EVM]: formatEVMAddress,
  [ChainTypeEnum.SVM]: formatSolanaAddress,
}

/**
 * Format address based on chain type
 */
export function formatAddress(address: string, chainType: ChainTypeEnum): string {
  const formatter = addressFormatters[chainType]
  return formatter(address)
}
