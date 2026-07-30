import type { Openfort } from '@openfort/openfort-js'

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
  return await parameters.client.embeddedWallet.exportPrivateKey()
}
