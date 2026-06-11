import { type AccountTypeEnum, ChainTypeEnum, type EmbeddedAccount, type RecoveryMethod } from '@openfort/openfort-js'
import type { Hex } from 'viem'
import type { ConnectedEmbeddedEthereumWallet } from '../../ethereum/types'
import type { ConnectedEmbeddedSolanaWallet } from '../../solana/types'
import type { BaseFlowState } from './auth/status'

export type EthereumUserWallet = ConnectedEmbeddedEthereumWallet

/** Solana embedded wallet shape (mirrors UserWallet for SVM). address is Base58. Discriminate with chainType. */
export type SolanaUserWallet = {
  address: string
  id: string
  chainType: typeof ChainTypeEnum.SVM
  isAvailable: boolean
  isActive?: boolean
  isConnecting?: boolean
  accounts: { id: string }[]
  recoveryMethod?: RecoveryMethod
  accountType?: AccountTypeEnum
  createdAt?: number
}

export type UserWallet = EthereumUserWallet | SolanaUserWallet

export type WalletFlowStatus =
  | BaseFlowState
  | {
      status: 'creating' | 'connecting'
      address?: Hex
      error?: never
    }

export function embeddedAccountToUserWallet(account: EmbeddedAccount): EthereumUserWallet {
  return {
    id: account.id,
    address: account.address as `0x${string}`,
    ownerAddress: account.ownerAddress,
    implementationType: account.implementationType,
    chainType: ChainTypeEnum.EVM,
    walletIndex: 0,
    recoveryMethod: account.recoveryMethod,
    getProvider: async () => {
      throw new Error('Wallet not yet loaded; use useEthereumEmbeddedWallet to access provider')
    },
    isAvailable: true,
    isActive: false,
    isConnecting: false,
    accounts: [{ id: account.id, chainId: account.chainId }],
    connectorType: 'embedded',
    walletClientType: 'openfort',
    accountId: account.id,
    accountType: account.accountType,
    createdAt: account.createdAt,
    salt: account.salt,
  }
}

/** Build SolanaUserWallet from a ConnectedEmbeddedSolanaWallet (e.g. for route navigation). */
export function toSolanaUserWallet(w: ConnectedEmbeddedSolanaWallet): SolanaUserWallet {
  return {
    id: w.id,
    address: w.address,
    chainType: ChainTypeEnum.SVM,
    isAvailable: true,
    accounts: [{ id: w.id }],
    recoveryMethod: w.recoveryMethod,
  }
}

/** Build SolanaUserWallet from a single SVM embedded account (e.g. for post-auth return). */
export function embeddedAccountToSolanaUserWallet(account: EmbeddedAccount): SolanaUserWallet {
  return {
    address: account.address,
    id: account.id,
    chainType: ChainTypeEnum.SVM,
    isAvailable: true,
    accounts: [{ id: account.id }],
    recoveryMethod: account.recoveryMethod,
    accountType: account.accountType,
    createdAt: account.createdAt,
  }
}
