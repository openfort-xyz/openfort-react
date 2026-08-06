import {
  type AccountTypeEnum,
  ChainTypeEnum,
  type EmbeddedAccount,
  type Openfort,
  type RecoveryMethod,
} from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../components/Openfort/types.js'
import { asOpenfortError } from '../errors/base.js'
import { WalletConfigNotFoundError } from '../errors/config.js'
import { WalletCreationError } from '../errors/wallet.js'
import { buildRecoveryParams } from '../shared/utils/recovery.js'
import { activateEmbeddedAccount } from './activateEmbeddedAccount.js'
import { buildClientRecoveryConfig } from './buildClientRecoveryConfig.js'

/** Chain-resolved account shape passed straight to the core SDK. */
export type EmbeddedAccountRequest = {
  accountType: AccountTypeEnum
  /** Only sent for account types that are deployed to a specific chain. */
  chainId?: number
}

/** Recovery inputs the caller collected from the user. */
export type EmbeddedRecoveryInput = {
  recoveryMethod?: RecoveryMethod
  passkeyId?: string
  password?: string
  otpCode?: string
}

export type CreateEmbeddedWalletParameters = {
  client: Openfort
  walletConfig: OpenfortWalletConfig | undefined
  chainType: ChainTypeEnum
  accountRequest: EmbeddedAccountRequest
  recovery: EmbeddedRecoveryInput | undefined
  assertCurrent: () => void
  shouldPublish: () => boolean
  setActiveEmbeddedAddress: (address: string | undefined) => void
  updateEmbeddedAccounts: (options?: { silent?: boolean }) => Promise<EmbeddedAccount[] | undefined>
}

/**
 * Creates an embedded wallet on the given chain and publishes it as the active account.
 *
 * @param parameters - Client, wallet config, chain-resolved account request and recovery inputs.
 * @returns The created account.
 * @throws {WalletConfigNotFoundError} When the provider was mounted without a wallet config.
 */
export async function createEmbeddedWallet(parameters: CreateEmbeddedWalletParameters): Promise<EmbeddedAccount> {
  const {
    client,
    walletConfig,
    chainType,
    accountRequest,
    recovery,
    assertCurrent,
    shouldPublish,
    setActiveEmbeddedAddress,
    updateEmbeddedAccounts,
  } = parameters

  if (!walletConfig) {
    throw new WalletConfigNotFoundError()
  }

  try {
    const recoveryParams = await buildRecoveryParams(recovery, buildClientRecoveryConfig(client, walletConfig))
    assertCurrent()

    const account = await client.embeddedWallet.create({ chainType, ...accountRequest, recoveryParams })

    await activateEmbeddedAccount({
      account,
      assertCurrent,
      shouldPublish,
      setActiveEmbeddedAddress,
      updateEmbeddedAccounts,
    })

    return account
  } catch (error) {
    throw asOpenfortError(
      error,
      (cause) => new WalletCreationError({ chain: chainType === ChainTypeEnum.EVM ? 'Ethereum' : 'Solana', cause })
    )
  }
}
