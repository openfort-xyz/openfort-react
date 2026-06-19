/**
 * Dynamic provider tree for the Openfort playground.
 *
 * - evm: ThemeProvider → QueryClientProvider → WagmiProvider → OpenfortWagmiBridge → OpenfortProvider
 * - svm: ThemeProvider → OpenfortProvider (no wagmi, no TanStack Query)
 *
 * Switching modes remounts the provider tree; wagmi/tanstack state is lost when leaving evm.
 */

import { ChainTypeEnum, OpenfortProvider } from '@openfort/react'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { getDefaultConfig, getDefaultConnectors, OpenfortWagmiBridge } from '@openfort/react/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createConfig, http, useChainId, WagmiProvider } from 'wagmi'
import { ThemeProvider } from '@/components/theme-provider'
import { EthereumAddressProviderEmbedded, EthereumAddressProviderWagmi } from '@/contexts/EthereumAddressContext'
import { getFundingTargetForChain, PLAYGROUND_EVM_CHAINS, SOLANA_FUNDING_TARGET } from '@/lib/chains'
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

/**
 * Keeps the Deposit-hub funding target in sync with the active EVM chain, so
 * switching networks in the OpenfortButton lands deposits on that chain's USDC.
 * No-ops on chains without a configured USDC (testnets), keeping the prior target.
 * Drops any `targetAddress` so deposits land on the active EVM embedded wallet —
 * clears a stale Solana address left by the SVM sync after a mode switch.
 */
function FundingTargetSync() {
  const chainId = useChainId()
  const providerOptions = useAppStore((s) => s.providerOptions)
  const setProviderOptions = useAppStore((s) => s.setProviderOptions)

  useEffect(() => {
    const target = getFundingTargetForChain(chainId)
    if (!target) return
    const funding = providerOptions.uiConfig?.funding
    if (
      funding?.targetChain === target.targetChain &&
      funding?.targetCurrency === target.targetCurrency &&
      funding?.targetAddress === undefined
    ) {
      return
    }
    const { targetAddress: _drop, ...rest } = funding ?? {}
    setProviderOptions({
      ...providerOptions,
      uiConfig: {
        ...providerOptions.uiConfig,
        funding: { ...rest, ...target },
      },
    })
  }, [chainId, providerOptions, setProviderOptions])

  return null
}

/**
 * SVM counterpart of {@link FundingTargetSync}: while in Solana mode, points the
 * Deposit-hub target at Solana mainnet USDC and the active Solana embedded wallet,
 * so a Coinbase/crypto deposit bridges and lands as USDC in that wallet.
 *
 * Mirrors the EVM sync: flip the target chain/currency to Solana *immediately* on
 * mount (this component only renders in SVM mode), not gated on the wallet being
 * fully connected. `targetAddress` is set once the Solana wallet resolves; until
 * then DepositCex falls back to the SVM embedded account, so the CEX page never
 * strands on "Preparing…" while the wallet is still connecting.
 */
function SolanaFundingTargetSync() {
  const solana = useSolanaEmbeddedWallet()
  const providerOptions = useAppStore((s) => s.providerOptions)
  const setProviderOptions = useAppStore((s) => s.setProviderOptions)
  const address = solana.status === 'connected' ? solana.activeWallet?.address : undefined

  useEffect(() => {
    const funding = providerOptions.uiConfig?.funding
    if (
      funding?.targetChain === SOLANA_FUNDING_TARGET.targetChain &&
      funding?.targetCurrency === SOLANA_FUNDING_TARGET.targetCurrency &&
      funding?.targetAddress === address
    ) {
      return
    }
    setProviderOptions({
      ...providerOptions,
      uiConfig: {
        ...providerOptions.uiConfig,
        funding: { ...funding, ...SOLANA_FUNDING_TARGET, targetAddress: address },
      },
    })
  }, [address, providerOptions, setProviderOptions])

  return null
}

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
              <FundingTargetSync />
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
          <SolanaFundingTargetSync />
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
