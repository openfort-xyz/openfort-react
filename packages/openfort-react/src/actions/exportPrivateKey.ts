import type { Openfort } from '@openfort/openfort-js'
import { asOpenfortError } from '../errors/base.js'
import { WalletError } from '../errors/wallet.js'

type ExportPrivateKeyParameters = {
  client: Openfort
}

/**
 * Exports the active embedded wallet's raw private key.
 *
 * @param parameters - Authenticated Openfort client.
 * @returns The private key: hex on EVM, base58-encoded secret key on Solana.
 */
export async function exportPrivateKey(parameters: ExportPrivateKeyParameters): Promise<string> {
  try {
    return await parameters.client.embeddedWallet.exportPrivateKey()
  } catch (error) {
    throw asOpenfortError(error, (cause) => new WalletError('Failed to export private key.', { cause }))
  }
}
