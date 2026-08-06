import type { EmbeddedAccount } from '@openfort/openfort-js'
import { WalletNotFoundError } from '../errors/wallet.js'

type FindEmbeddedAccountParameters = {
  accounts: EmbeddedAccount[]
  address: string
  /**
   * Canonical form used for the comparison. EVM addresses are case-insensitive
   * so they lowercase; Solana addresses are base58 and compare verbatim.
   */
  normalizeAddress: (address: string) => string
}

/**
 * Looks up an embedded account by address within a single chain's account list.
 *
 * @param parameters - Candidate accounts, target address and the chain's address normalizer.
 * @returns The matching account.
 * @throws {WalletNotFoundError} When no account carries that address.
 */
export function findEmbeddedAccount(parameters: FindEmbeddedAccountParameters): EmbeddedAccount {
  const { accounts, address, normalizeAddress } = parameters

  const target = normalizeAddress(address)
  const account = accounts.find((acc) => normalizeAddress(acc.address) === target)

  if (!account) {
    throw new WalletNotFoundError(`Embedded wallet ${address} not found.`)
  }

  return account
}
