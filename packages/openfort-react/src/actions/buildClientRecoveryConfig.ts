import type { Openfort } from '@openfort/openfort-js'
import type { OpenfortWalletConfig } from '../components/Openfort/types.js'
import type { BuildRecoveryParamsConfig } from '../shared/utils/recovery.js'

/**
 * Binds the wallet config and a client's identity accessors into the context
 * `buildRecoveryParams` needs to mint an encryption session.
 *
 * @param client - Authenticated Openfort client.
 * @param walletConfig - Provider wallet config, or `undefined` when unconfigured.
 * @returns Config accepted by `buildRecoveryParams`.
 */
export function buildClientRecoveryConfig(
  client: Openfort,
  walletConfig: OpenfortWalletConfig | undefined
): BuildRecoveryParamsConfig {
  return {
    walletConfig,
    getAccessToken: () => client.getAccessToken(),
    getUserId: async () => (await client.user.get())?.id,
  }
}
