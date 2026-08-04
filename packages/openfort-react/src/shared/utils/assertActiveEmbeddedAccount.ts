import { ChainTypeEnum, type EmbeddedAccount } from '@openfort/openfort-js'
import { WalletNotConnectedError } from '../../errors/wallet.js'

export type EmbeddedAccountIdentity = Partial<Pick<EmbeddedAccount, 'id' | 'address' | 'chainType'>>

function addressesMatch(expected: EmbeddedAccountIdentity, current: EmbeddedAccountIdentity): boolean {
  if (!expected.address) return true
  if (!current.address) return false
  if (expected.chainType === ChainTypeEnum.EVM || current.chainType === ChainTypeEnum.EVM) {
    return expected.address.toLowerCase() === current.address.toLowerCase()
  }
  return expected.address === current.address
}

/** Ensures an implicit core operation still targets its invocation-time embedded account. */
export function assertActiveEmbeddedAccount(
  expected: EmbeddedAccountIdentity | null,
  current: EmbeddedAccountIdentity | null | undefined
): void {
  const hasIdentity = expected && (expected.id || expected.address || expected.chainType)
  const matches =
    hasIdentity &&
    current &&
    (!expected.id || expected.id === current.id) &&
    (!expected.chainType || expected.chainType === current.chainType) &&
    addressesMatch(expected, current)

  if (!matches) {
    throw new WalletNotConnectedError('The active wallet changed before the operation could run.')
  }
}
