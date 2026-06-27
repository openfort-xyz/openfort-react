import type { CreateConfigParameters } from '@wagmi/core'
import type { CoinbaseWalletParameters } from 'wagmi/connectors'

/**
 * Options for managed wagmi setup, passed via the `wagmi` prop on `OpenfortProvider`.
 *
 * When provided — and no `WagmiProvider`/`OpenfortWagmiBridge` is already present —
 * Openfort builds the wagmi config internally, so you don't need `getDefaultConfig`,
 * `WagmiProvider`, or `OpenfortWagmiBridge` boilerplate.
 *
 * The WalletConnect project ID is resolved from {@link walletConnectProjectId} here,
 * falling back to the value configured in the Openfort dashboard (External wallet
 * provider). Code always wins over the dashboard.
 */
export type OpenfortWagmiOptions = {
  /** Chains your app supports. Read once at mount, like wagmi's `createConfig`. */
  chains: CreateConfigParameters['chains']
  /** Per-chain transports. Defaults to a public `http()` transport per chain when omitted. */
  transports?: CreateConfigParameters['transports']
  /**
   * WalletConnect (Reown) project ID. An explicit value here overrides the dashboard.
   * Omit it to use the project ID configured in the Openfort dashboard.
   */
  walletConnectProjectId?: string
  appName?: string
  appIcon?: string
  appUrl?: string
  appDescription?: string
  coinbaseWalletPreference?: CoinbaseWalletParameters<'4'>['preference']
}
