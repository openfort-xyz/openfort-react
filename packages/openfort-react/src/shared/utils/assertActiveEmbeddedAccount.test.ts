import { ChainTypeEnum } from '@openfort/openfort-js'
import { describe, expect, it } from 'vitest'
import { WalletNotConnectedError } from '../../errors/wallet.js'
import { assertActiveEmbeddedAccount, type EmbeddedAccountIdentity } from './assertActiveEmbeddedAccount.js'

const EVM_ACCOUNT = {
  id: 'emb_evm',
  address: '0x1234567890abcdef1234567890abcdef12345678',
  chainType: ChainTypeEnum.EVM,
} satisfies EmbeddedAccountIdentity

describe('assertActiveEmbeddedAccount', () => {
  it('accepts the same EVM identity with a checksummed address', () => {
    expect(() =>
      assertActiveEmbeddedAccount({ ...EVM_ACCOUNT, address: EVM_ACCOUNT.address.toUpperCase() }, EVM_ACCOUNT)
    ).not.toThrow()
  })

  it.each([
    [{ ...EVM_ACCOUNT, id: 'emb_other' }, EVM_ACCOUNT],
    [{ ...EVM_ACCOUNT, address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }, EVM_ACCOUNT],
    [{ ...EVM_ACCOUNT, chainType: ChainTypeEnum.SVM }, EVM_ACCOUNT],
    [EVM_ACCOUNT, null],
    [null, EVM_ACCOUNT],
  ])('rejects when the invocation identity no longer matches', (expected, current) => {
    expect(() => assertActiveEmbeddedAccount(expected, current)).toThrow(WalletNotConnectedError)
  })
})
