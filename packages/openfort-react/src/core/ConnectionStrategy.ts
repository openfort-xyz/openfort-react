import type { ChainTypeEnum, EmbeddedAccount, EmbeddedState, Openfort, User } from '@openfort/openfort-js'
import { baseSepolia, sepolia } from 'viem/chains'
import type { OpenfortWalletConfig } from '../components/Openfort/types'
import type { ExternalConnectorProps } from '../wallets/useExternalConnectors'

/** Default chain when EVM without Wagmi and walletConfig.ethereum.chainId is missing. Sepolia. */
export const DEFAULT_DEV_CHAIN_ID = sepolia.id

/** Default testnet chain for balance/hooks when no chain context. Base Sepolia. */
export const DEFAULT_TESTNET_CHAIN_ID = baseSepolia.id

export interface ConnectionStrategyState {
  user: User | null
  embeddedAccounts: EmbeddedAccount[] | undefined
  /** When set, strategy uses this as the connected address (e.g. after user switches active embedded wallet). */
  activeEmbeddedAddress?: string | null
  chainType: ChainTypeEnum
  /** For Solana embedded: only treat as connected when READY (wallet actually recovered). */
  embeddedState?: EmbeddedState
}

export type ConnectRoute = 'embedded' | 'external-wallets'

export interface ConnectionStrategy {
  readonly kind: 'bridge' | 'embedded'
  readonly chainType: ChainTypeEnum

  isConnected(state: ConnectionStrategyState): boolean
  getChainId(): number | undefined
  getAddress(state: ConnectionStrategyState): string | undefined
  /** When 'external-wallets', ConnectModal may show Connectors page; when 'embedded' only, skip to providers. */
  getConnectRoutes(): ConnectRoute[]
  /** External wallet connectors; only when wagmi/bridge exists. Otherwise []. */
  getConnectors(): ExternalConnectorProps[]

  /** @param chainId - Current chain for EVM; when provided, uses this for fee sponsorship/rpc instead of config default. */
  initProvider(openfort: Openfort, walletConfig: OpenfortWalletConfig, chainId?: number): Promise<void>
  disconnect(openfort: Openfort): Promise<void>
}
