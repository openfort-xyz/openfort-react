'use client'

import type { ReactNode } from 'react'
import { useMemo, useRef } from 'react'
import { createConfig, WagmiProvider } from 'wagmi'
import getDefaultConfig from './defaultConfig'
import { OpenfortWagmiBridge } from './OpenfortWagmiBridge'
import type { OpenfortWagmiOptions } from './options'
import { useClientConfig } from './useClientConfig'

type ManagedEvmProviderProps = {
  publishableKey: string
  backendUrl?: string
  wagmi: OpenfortWagmiOptions
  children: ReactNode
}

/**
 * Managed wagmi setup. Builds the wagmi config from {@link ManagedEvmProviderProps.wagmi}
 * plus the WalletConnect project ID resolved from the dashboard, then renders
 * `WagmiProvider` + `OpenfortWagmiBridge` so the developer writes no wagmi boilerplate.
 *
 * Lazy-loaded by `OpenfortProvider` so wagmi is only pulled in when managed mode is used
 * (Solana / auth-only apps never load it).
 */
export function ManagedEvmProvider({ publishableKey, backendUrl, wagmi, children }: ManagedEvmProviderProps) {
  const { walletConnectProjectId: dashboardWalletConnectProjectId } = useClientConfig(publishableKey, backendUrl)

  // Precedence: an explicit code value always wins; otherwise use the dashboard value.
  const walletConnectProjectId = wagmi.walletConnectProjectId ?? dashboardWalletConnectProjectId

  // chains/transports are static config (read once at mount, like createConfig today). Only
  // walletConnectProjectId is dynamic — on a cold start (no cache) it arrives from the dashboard
  // a beat after first paint, so the config is rebuilt solely when it changes, never on unrelated
  // re-renders. Repeat visits seed it synchronously from cache, so there is no rebuild at all.
  const optionsRef = useRef(wagmi)
  const config = useMemo(
    () =>
      createConfig(
        getDefaultConfig({
          appName: optionsRef.current.appName ?? 'Openfort',
          appIcon: optionsRef.current.appIcon,
          appUrl: optionsRef.current.appUrl,
          appDescription: optionsRef.current.appDescription,
          chains: optionsRef.current.chains,
          transports: optionsRef.current.transports,
          coinbaseWalletPreference: optionsRef.current.coinbaseWalletPreference,
          walletConnectProjectId,
        })
      ),
    [walletConnectProjectId]
  )

  return (
    <WagmiProvider config={config}>
      <OpenfortWagmiBridge>{children}</OpenfortWagmiBridge>
    </WagmiProvider>
  )
}
