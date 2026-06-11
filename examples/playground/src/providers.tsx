/**
 * Dynamic provider tree for the Openfort playground.
 *
 * - evm: ThemeProvider → QueryClientProvider → WagmiProvider → OpenfortWagmiBridge → OpenfortProvider
 * - svm: ThemeProvider → OpenfortProvider (no wagmi, no TanStack Query)
 *
 * Switching modes remounts the provider tree; wagmi/tanstack state is lost when leaving evm.
 */

import { ChainTypeEnum, OpenfortProvider } from '@openfort/react'
import { getDefaultConfig, getDefaultConnectors, OpenfortWagmiBridge } from '@openfort/react/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { ThemeProvider } from '@/components/theme-provider'
import { EthereumAddressProviderEmbedded, EthereumAddressProviderWagmi } from '@/contexts/EthereumAddressContext'
import { PLAYGROUND_EVM_CHAINS } from '@/lib/chains'
import { useAppStore } from './lib/useAppStore'

export type OpenfortPlaygroundMode = 'svm' | 'evm'

const STORAGE_KEY = 'openfort-playground-mode'

function readStoredMode(): OpenfortPlaygroundMode {
  if (typeof window === 'undefined') return 'evm'
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === 'evm' || raw === 'svm') return raw
  return 'evm'
}

type PlaygroundModeContextValue = {
  mode: OpenfortPlaygroundMode
  setMode: (mode: OpenfortPlaygroundMode) => void
  /** True right after a mode switch; used to show "Restoring session" only during remount, not during signup/login. */
  isPostModeSwitch: boolean
  clearPostModeSwitch: () => void
}

const PlaygroundModeContext = createContext<PlaygroundModeContextValue | null>(null)

export function PlaygroundModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<OpenfortPlaygroundMode>(readStoredMode)
  const [isPostModeSwitch, setIsPostModeSwitch] = useState(false)

  const setMode = useCallback((next: OpenfortPlaygroundMode) => {
    setModeState((prev) => {
      if (prev !== next) setIsPostModeSwitch(true)
      return next
    })
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const clearPostModeSwitch = useCallback(() => setIsPostModeSwitch(false), [])

  // Safety net: auto-clear after 4 s in case SDK isLoading gets stuck
  useEffect(() => {
    if (!isPostModeSwitch) return
    const id = setTimeout(() => setIsPostModeSwitch(false), 4_000)
    return () => clearTimeout(id)
  }, [isPostModeSwitch])

  const value = useMemo(
    () => ({ mode, setMode, isPostModeSwitch, clearPostModeSwitch }),
    [mode, setMode, isPostModeSwitch, clearPostModeSwitch]
  )
  return <PlaygroundModeContext.Provider value={value}>{children}</PlaygroundModeContext.Provider>
}

export function usePlaygroundMode(): PlaygroundModeContextValue {
  const ctx = useContext(PlaygroundModeContext)
  if (!ctx) throw new Error('usePlaygroundMode must be used within PlaygroundModeProvider')
  return ctx
}

/** Optional: called before mode switch when in evm (e.g. to clear wagmi cache). */
const ModeSwitchContext = createContext<{ onBeforeModeSwitch?: () => void }>({})
export const useModeSwitchContext = () => useContext(ModeSwitchContext)

// ─── Wagmi config (shared across all modes) ─────────────────────────────────

const defaultConnectors = getDefaultConnectors({
  app: { name: 'Openfort demo' },
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
})

const wagmiChains = PLAYGROUND_EVM_CHAINS.map((c) => c.viemChain) as [
  (typeof PLAYGROUND_EVM_CHAINS)[number]['viemChain'],
  ...(typeof PLAYGROUND_EVM_CHAINS)[number]['viemChain'][],
]

const wagmiTransports = Object.fromEntries(PLAYGROUND_EVM_CHAINS.map((c) => [c.id, http(c.rpcUrl)])) as Record<
  number,
  ReturnType<typeof http>
>

const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: 'Openfort demo',
    chains: wagmiChains,
    transports: wagmiTransports,
    connectors: [...defaultConnectors],
  })
)

// ─── Providers ─────────────────────────────────────────────────────────────

const MODE_TO_CHAIN = { evm: ChainTypeEnum.EVM, svm: ChainTypeEnum.SVM } as const

function WagmiProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const { providerOptions } = useAppStore()
  const { mode } = usePlaygroundMode()
  const options = useMemo(
    () => ({
      ...providerOptions,
      walletConfig: providerOptions.walletConfig
        ? { ...providerOptions.walletConfig, chainType: MODE_TO_CHAIN[mode] }
        : undefined,
    }),
    [providerOptions, mode]
  )
  const value = useMemo(() => ({ onBeforeModeSwitch: () => queryClient.clear() }), [queryClient])
  return (
    <ModeSwitchContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <OpenfortWagmiBridge>
            <OpenfortProvider {...options}>
              <EthereumAddressProviderWagmi>{children}</EthereumAddressProviderWagmi>
            </OpenfortProvider>
          </OpenfortWagmiBridge>
        </WagmiProvider>
      </QueryClientProvider>
    </ModeSwitchContext.Provider>
  )
}

function OpenfortOnlyProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  const { providerOptions } = useAppStore()
  const { mode } = usePlaygroundMode()
  const options = useMemo(
    () => ({
      ...providerOptions,
      walletConfig: providerOptions.walletConfig
        ? { ...providerOptions.walletConfig, chainType: MODE_TO_CHAIN[mode] }
        : undefined,
    }),
    [providerOptions, mode]
  )
  return (
    <ModeSwitchContext.Provider value={{}}>
      <QueryClientProvider client={queryClient}>
        <OpenfortProvider {...options}>
          <EthereumAddressProviderEmbedded>{children}</EthereumAddressProviderEmbedded>
        </OpenfortProvider>
      </QueryClientProvider>
    </ModeSwitchContext.Provider>
  )
}

export function Providers({ children }: { children?: React.ReactNode }) {
  const { mode } = usePlaygroundMode()

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {mode === 'evm' ? (
        <WagmiProviders>{children}</WagmiProviders>
      ) : (
        <OpenfortOnlyProviders>{children}</OpenfortOnlyProviders>
      )}
    </ThemeProvider>
  )
}
