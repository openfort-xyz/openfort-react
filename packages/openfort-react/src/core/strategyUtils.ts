import type { ChainTypeEnum, EmbeddedAccount } from '@openfort/openfort-js'
import { RecoveryMethod } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../components/Openfort/types'

export function firstEmbeddedAddress(
  accounts: EmbeddedAccount[] | undefined,
  chainType: ChainTypeEnum
): string | undefined {
  if (!accounts?.length) return undefined

  const forChain = accounts.filter((a) => a.chainType === chainType)
  if (!forChain.length) return undefined

  const automatic = forChain.find((a) => a.recoveryMethod === RecoveryMethod.AUTOMATIC)
  if (automatic) return automatic.address

  const passkey = forChain.find((a) => a.recoveryMethod === RecoveryMethod.PASSKEY)
  if (passkey) return passkey.address

  return forChain[0].address
}

export function resolveEthereumFeeSponsorship(
  config: OpenfortWalletConfig | undefined,
  chainId: number
): { feeSponsorship: string } | undefined {
  // openfort-js getEthereumProvider expects { feeSponsorship: string }. Returning { policy }
  // here silently dropped sponsorship at provider init (the key never matched).
  const feeSponsorship = config?.ethereum?.ethereumFeeSponsorshipId
  if (!feeSponsorship) return undefined
  if (typeof feeSponsorship === 'string') return { feeSponsorship }
  if (typeof feeSponsorship === 'object' && chainId in feeSponsorship) {
    return { feeSponsorship: (feeSponsorship as Record<number, string>)[chainId] }
  }
  return undefined
}
