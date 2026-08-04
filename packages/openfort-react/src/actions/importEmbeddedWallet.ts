import type { EmbeddedAccount } from '@openfort/openfort-js'
import { ChainTypeEnum } from '@openfort/openfort-js'
import { asOpenfortError } from '../errors/base.js'
import { WalletConfigNotFoundError } from '../errors/config.js'
import { WalletImportError } from '../errors/wallet.js'
import { buildRecoveryParams } from '../shared/utils/recovery.js'
import { activateEmbeddedAccount } from './activateEmbeddedAccount.js'
import { buildClientRecoveryConfig } from './buildClientRecoveryConfig.js'
import type { CreateEmbeddedWalletParameters } from './createEmbeddedWallet.js'

type ImportEmbeddedWalletParameters = CreateEmbeddedWalletParameters & {
  /** Raw private key: hex on EVM, base58-encoded secret key on Solana. */
  privateKey: string
}

/**
 * Imports an embedded wallet from a raw private key and publishes it as the active account.
 *
 * @param parameters - Everything `createEmbeddedWallet` takes, plus the private key.
 * @returns The imported account.
 * @throws {WalletConfigNotFoundError} When the provider was mounted without a wallet config.
 */
export async function importEmbeddedWallet(parameters: ImportEmbeddedWalletParameters): Promise<EmbeddedAccount> {
  const {
    client,
    walletConfig,
    chainType,
    accountRequest,
    recovery,
    privateKey,
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

    const account = await client.embeddedWallet.import({ privateKey, chainType, ...accountRequest, recoveryParams })

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
      (cause) => new WalletImportError({ chain: chainType === ChainTypeEnum.EVM ? 'Ethereum' : 'Solana', cause })
    )
  }
}
