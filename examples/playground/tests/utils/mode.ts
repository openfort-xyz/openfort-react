import type { Page } from '@playwright/test'

export type PlaygroundMode = 'evm' | 'svm'

export function setPlaygroundMode(page: Page, mode: PlaygroundMode) {
  return page.addInitScript((m) => {
    localStorage.setItem('openfort-playground-mode', m)
  }, mode)
}

export function getModeFromProjectName(projectName: string): PlaygroundMode {
  if (projectName.includes('evm')) return 'evm'
  if (projectName.includes('solana')) return 'svm'
  throw new Error('Invalid project name')
}

export const EVM_ADDRESS_REGEX = /0x[a-f0-9]{4,}\.\.\.[a-f0-9]{4,}/i
export const EVM_TX_HASH_REGEX = /transaction hash:\s*0x[a-fA-F0-9]{6,}/i
export const EVM_SIGNED_REGEX = /signed message:\s*0x[a-f0-9]{6,}/i

/**
 * Solana base58 address (32-44 chars, excludes 0OIl)
 */
/** Solana wallet display: "7xKXt...9Yz" (truncated) */
export const SOLANA_ADDRESS_DISPLAY_REGEX = /[1-9A-HJ-NP-Za-km-z]{4,}\.\.\.[1-9A-HJ-NP-Za-km-z]{4,}/i
/** Solana UI shows "Signature: base58...base58" - allow ellipsis in middle */
export const SOLANA_SIGNED_REGEX = /Signature:\s*\S+/i
