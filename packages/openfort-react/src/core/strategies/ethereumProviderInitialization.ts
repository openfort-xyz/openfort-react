import { UnsupportedOperationError } from '../../errors/operation.js'
import type { OpenfortEmbeddedEthereumWalletProvider } from '../../ethereum/types.js'

type ConfigurableEthereumProvider = OpenfortEmbeddedEthereumWalletProvider & {
  updateFeeSponsorship?: (feeSponsorship: string) => void
}

type ProviderInfo = {
  icon: `data:image/${string}`
  name: string
  rdns: string
}

const OPENFORT_PROVIDER_INFO = {
  name: 'Openfort',
  rdns: 'xyz.openfort',
  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
} as const satisfies ProviderInfo

type AnnouncementRecord = {
  assertCurrent: () => void
  detail: Readonly<{
    info: Readonly<ProviderInfo & { uuid: string }>
    provider: OpenfortEmbeddedEthereumWalletProvider
  }>
}

const announcementRecords = new WeakMap<object, AnnouncementRecord>()

function createUuid(): string | null {
  if (!globalThis.crypto?.getRandomValues) return null
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function dispatchAnnouncement(record: AnnouncementRecord): void {
  try {
    record.assertCurrent()
  } catch {
    return
  }
  window.dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: record.detail }))
}

export function commitEthereumProviderConfiguration({
  provider,
  feeSponsorship,
  assertCurrent,
}: {
  provider: OpenfortEmbeddedEthereumWalletProvider
  feeSponsorship: string | undefined
  assertCurrent: () => void
}): void {
  assertCurrent()
  if (feeSponsorship) {
    const configurableProvider = provider as ConfigurableEthereumProvider
    if (typeof configurableProvider.updateFeeSponsorship !== 'function') {
      throw new UnsupportedOperationError({ operation: 'Embedded provider fee sponsorship updates' })
    }
    configurableProvider.updateFeeSponsorship(feeSponsorship)
    assertCurrent()
  }

  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return
  const existing = announcementRecords.get(provider)
  if (existing) {
    assertCurrent()
    existing.assertCurrent = assertCurrent
    existing.detail = Object.freeze({ info: existing.detail.info, provider })
    dispatchAnnouncement(existing)
    return
  }

  const uuid = createUuid()
  if (!uuid) return
  assertCurrent()
  const record: AnnouncementRecord = {
    assertCurrent,
    detail: Object.freeze({ info: Object.freeze({ ...OPENFORT_PROVIDER_INFO, uuid }), provider }),
  }
  announcementRecords.set(provider, record)
  window.addEventListener('eip6963:requestProvider', () => dispatchAnnouncement(record))
  dispatchAnnouncement(record)
}
