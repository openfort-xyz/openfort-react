'use client'

import {
  ChainTypeEnum,
  RecoveryMethod,
  type SDKOverrides,
  type ThirdPartyAuthConfiguration,
} from '@openfort/openfort-js'
import { Buffer } from 'buffer'
import type React from 'react'
import { lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { DEFAULT_DEV_CHAIN_ID } from '../../core/ConnectionStrategy.js'

import { OpenfortConfigError } from '../../errors/config.js'
import { OpenfortEthereumBridgeContext } from '../../ethereum/OpenfortEthereumBridgeContext.js'
import { useThemeFont } from '../../hooks/useGoogleFont.js'
import { CoreOpenfortProvider } from '../../openfort/CoreOpenfortProvider.js'
import type { useConnectCallbackProps } from '../../openfort/connectCallbackTypes.js'
import type { CustomTheme, Languages, Mode, Theme } from '../../types.js'
import { logger, setDebugLogsEnabled } from '../../utils/logger.js'
import { buildChainFromConfig } from '../../utils/rpc.js'
import { isFamily } from '../../utils/wallets.js'

import {
  type ConfigContextValue,
  FormContext,
  type FormContextValue,
  OpenfortContext,
  RoutingContext,
  type RoutingContextValue,
  SignRequestContext,
  type SignRequestContextValue,
  type ThemeContextValue,
  ThemeStateContext,
} from './context.js'
import {
  type BuyFormState,
  type ConnectUIOptions,
  type DebugModeOptions,
  defaultBuyFormState,
  defaultSendFormState,
  notStoredInHistoryRoutes,
  type OpenfortUIOptionsExtended,
  type OpenfortWalletConfig,
  type RouteOptions,
  routes,
  type SendFormState,
  type SetRouteOptions,
  type SignRequest,
  UIAuthProvider,
} from './types.js'

// These chunks are lazy-loaded with static specifiers so every bundler (Vite, Rollup, webpack)
// can resolve and code-split them. Do NOT add a vite-ignore hint to these imports: it makes
// Vite's dependency pre-bundler keep the import external, so the relative path resolves against
// node_modules/.vite/deps instead of the package and the provider fails to load in dev
// ("Failed to resolve import ../../solana/SolanaContext.js"), blanking any Vite app.
const SolanaContextProvider = lazy(() =>
  import('../../solana/SolanaContext.js').then((m) => ({ default: m.SolanaContextProvider }))
)

const LazyEmbeddedWalletWagmiSync = lazy(() =>
  import('../../wagmi/useEmbeddedWalletWagmiSync.js').then((m) => ({
    default: m.EmbeddedWalletWagmiSync,
  }))
)

const LazyConnectKitModal = lazy(() => import('../ConnectModal/index.js'))

/** {@link OpenfortProvider} props. */
type OpenfortProviderProps = {
  children?: React.ReactNode
  debugMode?: boolean | DebugModeOptions
  publishableKey: string
  uiConfig?: ConnectUIOptions
  walletConfig?: OpenfortWalletConfig
  overrides?: SDKOverrides
  thirdPartyAuth?: ThirdPartyAuthConfiguration
} & useConnectCallbackProps

let openfortProviderWarnedNoWagmi = false
let openfortProviderWarnedNoAutomaticRecovery = false

/** Placeholder connector for a modal session that has not picked one yet. */
const initialConnector: RoutingContextValue['connector'] = { id: '' }

/**
 * Root provider for Openfort. Wrap your app with this to enable connect modal, auth, and wallet features.
 * Requires publishableKey. Use with wagmi's OpenfortProvider for EVM + wagmi.
 *
 * @remarks Client-only. Use in a Client Component (e.g. add `"use client"` in Next.js App Router).
 *
 * @example
 * ```tsx
 * <OpenfortProvider publishableKey="pk_test_...">
 *   <App />
 * </OpenfortProvider>
 * ```
 */
export const OpenfortProvider = ({
  children,
  uiConfig,
  onConnect,
  onDisconnect,
  debugMode,
  publishableKey,
  walletConfig,
  overrides,
  thirdPartyAuth,
}: OpenfortProviderProps) => {
  const bridge = useContext(OpenfortEthereumBridgeContext)
  const hasWagmi = !!bridge
  // External wallet sign-in is available via any connector — WalletConnect (QR)
  // or an injected/MetaMask browser extension — not WalletConnect alone.
  const EXTERNAL_WALLET_CONNECTOR_IDS = ['walletConnect', 'injected', 'metaMask', 'metaMaskSDK', 'io.metamask']
  const hasExternalWallets = bridge?.connectors?.some((c) => EXTERNAL_WALLET_CONNECTOR_IDS.includes(c.id)) ?? false
  const hasSolana = !!walletConfig?.solana

  // Only allow for mounting OpenfortProvider once, so we avoid weird global
  // state collisions.
  if (useContext(OpenfortContext)) {
    throw new OpenfortConfigError('Multiple, nested usages of `OpenfortProvider` detected.', {
      metaMessages: ['Render exactly one `OpenfortProvider` at the root of the app.'],
    })
  }

  const debugModeOptions: Required<DebugModeOptions & { debugRoutes?: boolean }> = useMemo(() => {
    const result =
      typeof debugMode === 'undefined'
        ? { shieldDebugMode: false, openfortCoreDebugMode: false, openfortReactDebugMode: false, debugRoutes: false }
        : typeof debugMode === 'boolean'
          ? {
              shieldDebugMode: debugMode,
              openfortCoreDebugMode: debugMode,
              openfortReactDebugMode: debugMode,
              debugRoutes: false,
            }
          : {
              shieldDebugMode: debugMode.shieldDebugMode ?? false,
              openfortCoreDebugMode: debugMode.openfortCoreDebugMode ?? false,
              openfortReactDebugMode: debugMode.openfortReactDebugMode ?? false,
              debugRoutes: debugMode.debugRoutes ?? false,
            }
    return result
  }, [debugMode])

  useEffect(() => {
    setDebugLogsEnabled(debugModeOptions.openfortReactDebugMode)
  }, [debugModeOptions.openfortReactDebugMode])

  const injectedConnector = bridge?.connectors?.find((c) => c.id === 'injected')
  const allowAutomaticRecovery = !!(walletConfig?.createEncryptedSessionEndpoint || walletConfig?.getEncryptionSession)

  const defaultUIOptions = useMemo<OpenfortUIOptionsExtended>(
    () => ({
      appName: 'Openfort',
      theme: 'auto',
      mode: 'auto',
      language: 'en-US',
      hideBalance: false,
      hideTooltips: false,
      hideQuestionMarkCTA: false,
      hideNoWalletCTA: false,
      walletConnectCTA: 'link',
      hideRecentBadge: false,
      avoidLayoutShift: true,
      embedGoogleFonts: false,
      truncateLongENSAddress: true,
      walletConnectName: undefined,
      reducedMotion: false,
      disclaimer: null,
      bufferPolyfill: true,
      customAvatar: undefined,
      enforceSupportedChains: false,
      ethereumOnboardingUrl: undefined,
      walletOnboardingUrl: undefined,
      buyWithCardUrl: undefined,
      buyFromExchangeUrl: undefined,
      buyTroubleshootingUrl: undefined,
      disableSiweRedirect: false,
      walletRecovery: {
        allowedMethods: [RecoveryMethod.PASSWORD, ...(allowAutomaticRecovery ? [RecoveryMethod.AUTOMATIC] : [])],
        defaultMethod: allowAutomaticRecovery ? RecoveryMethod.AUTOMATIC : RecoveryMethod.PASSWORD,
      },
      authProviders: hasExternalWallets
        ? [UIAuthProvider.GUEST, UIAuthProvider.EMAIL_OTP, UIAuthProvider.WALLET, UIAuthProvider.GOOGLE]
        : [UIAuthProvider.GUEST, UIAuthProvider.EMAIL_OTP, UIAuthProvider.GOOGLE],
    }),
    [allowAutomaticRecovery, hasExternalWallets]
  )

  const safeUiConfig = useMemo<OpenfortUIOptionsExtended>(() => {
    const merged = { ...defaultUIOptions, ...uiConfig } as OpenfortUIOptionsExtended
    let authProviders = merged.authProviders ?? defaultUIOptions.authProviders
    if (!hasExternalWallets && authProviders.includes(UIAuthProvider.WALLET)) {
      authProviders = authProviders.filter((p) => p !== UIAuthProvider.WALLET)
      if (process.env.NODE_ENV === 'development' && !openfortProviderWarnedNoWagmi) {
        openfortProviderWarnedNoWagmi = true
        logger.warn(
          '[@openfort/react] UIAuthProvider.WALLET was removed from authProviders because no WalletConnect connector is present. Pass walletConnectProjectId to getDefaultConfig/getDefaultConnectors to enable external wallet sign-in.'
        )
      }
    }
    const walletRecovery = {
      allowedMethods: merged.walletRecovery?.allowedMethods ?? defaultUIOptions.walletRecovery.allowedMethods,
      defaultMethod: merged.walletRecovery?.defaultMethod ?? defaultUIOptions.walletRecovery.defaultMethod,
    }
    if (walletRecovery.allowedMethods.includes(RecoveryMethod.AUTOMATIC) && !allowAutomaticRecovery) {
      walletRecovery.allowedMethods = walletRecovery.allowedMethods.filter((m) => m !== RecoveryMethod.AUTOMATIC)
      // An inline uiConfig literal gives this memo a new input every render, so
      // the warning needs its own latch to stay a one-off.
      if (!openfortProviderWarnedNoAutomaticRecovery) {
        openfortProviderWarnedNoAutomaticRecovery = true
        logger.warn(
          'Automatic recovery method was removed from allowedMethods because no recovery options are configured in the walletConfig. Please provide either createEncryptedSessionEndpoint or getEncryptionSession to enable automatic recovery.'
        )
      }
    }
    if (walletRecovery.allowedMethods.length === 0) {
      walletRecovery.allowedMethods = [RecoveryMethod.PASSWORD]
    }
    if (!walletRecovery.allowedMethods.includes(walletRecovery.defaultMethod)) {
      walletRecovery.defaultMethod = walletRecovery.allowedMethods[0] ?? defaultUIOptions.walletRecovery.defaultMethod
    }
    return { ...merged, authProviders, walletRecovery }
  }, [defaultUIOptions, uiConfig, hasExternalWallets, allowAutomaticRecovery])

  useEffect(() => {
    if (typeof window !== 'undefined' && safeUiConfig.bufferPolyfill && !window.Buffer) {
      window.Buffer = Buffer
    }
  }, [safeUiConfig.bufferPolyfill])

  const [ckTheme, setTheme] = useState<Theme>(safeUiConfig.theme ?? 'auto')
  const [ckMode, setMode] = useState<Mode>(safeUiConfig.mode ?? 'auto')
  const [ckCustomTheme, setCustomTheme] = useState<CustomTheme | undefined>(safeUiConfig.customTheme ?? {})
  const [ckLang, setLang] = useState<Languages>('en-US')
  const [open, setOpenWithoutHistory] = useState<boolean>(false)
  const [connector, setConnector] = useState<RoutingContextValue['connector']>(initialConnector)
  const [route, setRoute] = useState<RouteOptions>({ route: routes.LOADING })
  const [routeHistory, setRouteHistory] = useState<RouteOptions[]>([])

  const [resize, onResize] = useState<number>(0)
  const [emailInput, setEmailInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [sendForm, setSendForm] = useState<SendFormState>(defaultSendFormState)
  const [signRequest, setSignRequest] = useState<SignRequest | null>(null)
  const [buyForm, setBuyForm] = useState<BuyFormState>(defaultBuyFormState)
  const [headerLeftSlot, setHeaderLeftSlot] = useState<React.ReactNode | null>(null)
  const [chainType, setChainType] = useState<ChainTypeEnum>(walletConfig?.chainType ?? ChainTypeEnum.EVM)

  const setOpen = useCallback((value: boolean) => {
    if (value) {
      setRouteHistory([])
      // Reset route and connector to avoid stale state from a previous modal session
      // (e.g. a failed SIWE attempt leaving route on CONNECT with a stale connector)
      setRoute({ route: routes.LOADING })
      setConnector(initialConnector)
    }
    setOpenWithoutHistory(value)
  }, [])

  // Include Google Font that is needed for a themes
  useThemeFont(safeUiConfig.embedGoogleFonts ? ckTheme : ('' as Theme))

  // Sync theme/mode/lang from config before paint to avoid one-render lag
  useLayoutEffect(() => setTheme(safeUiConfig.theme ?? 'auto'), [safeUiConfig.theme])
  useLayoutEffect(() => setMode(safeUiConfig.mode ?? 'auto'), [safeUiConfig.mode])
  useLayoutEffect(() => setCustomTheme(safeUiConfig.customTheme ?? {}), [safeUiConfig.customTheme])
  useLayoutEffect(() => setLang(safeUiConfig.language || 'en-US'), [safeUiConfig.language])

  const chains = useMemo((): import('viem').Chain[] => {
    if (bridge?.switchChain?.chains?.length) {
      return bridge.switchChain.chains as import('viem').Chain[]
    }
    if (walletConfig?.ethereum) {
      const rpcUrls = walletConfig.ethereum.rpcUrls
      const defaultChainId = walletConfig.ethereum.chainId ?? DEFAULT_DEV_CHAIN_ID
      const chainIds =
        rpcUrls && Object.keys(rpcUrls).length > 0
          ? [...new Set([...Object.keys(rpcUrls).map(Number), defaultChainId])]
          : [defaultChainId]
      return chainIds.map((id) => buildChainFromConfig(id, rpcUrls))
    }
    return []
  }, [bridge?.switchChain?.chains, walletConfig?.ethereum])

  const chain = bridge?.account.chain
  const isConnected = bridge?.account.isConnected ?? false
  const isChainSupported = !chain?.id || (bridge?.config.chains?.some((c) => c.id === chain.id) ?? false)

  useEffect(() => {
    if (hasWagmi && isConnected && safeUiConfig.enforceSupportedChains && !isChainSupported) {
      setOpen(true)
      setRoute({ route: routes.ETH_SWITCH_NETWORK })
    }
  }, [hasWagmi, isConnected, isChainSupported, safeUiConfig.enforceSupportedChains, setOpen])

  useEffect(() => {
    if (hasWagmi && isFamily() && injectedConnector && bridge) {
      bridge.connect({ connector: injectedConnector })
    }
  }, [hasWagmi, injectedConnector, bridge])

  const typedSetRoute = useCallback((options: SetRouteOptions) => {
    const routeObj = typeof options === 'string' ? { route: options } : options
    const { route } = routeObj

    setRoute(routeObj)

    setRouteHistory((prev) => {
      const lastRoute = prev.length > 0 ? prev[prev.length - 1] : null
      if (lastRoute && lastRoute.route === route) return prev
      if (notStoredInHistoryRoutes.includes(route)) return prev
      return [...prev, routeObj]
    })
  }, [])

  const setPreviousRoute = useCallback(() => {
    setRouteHistory((prev) => {
      const newHistory = [...prev]
      newHistory.pop()
      const previous = newHistory[newHistory.length - 1]
      setRoute(previous ?? { route: routes.CONNECTED })
      return newHistory
    })
  }, [])

  const triggerResize = useCallback(() => {
    onResize((prev) => prev + 1)
  }, [])

  const [onBack, setOnBack] = useState<(() => void) | null>(null)

  const themeValue: ThemeContextValue = useMemo(
    () => ({
      setTheme,
      mode: ckMode,
      setMode,
      setCustomTheme,
      lang: ckLang,
      setLang,
    }),
    [ckMode, ckLang]
  )

  const routingValue: RoutingContextValue = useMemo(
    () => ({
      chainType,
      setChainType,
      open,
      setOpen,
      route,
      setRoute: typedSetRoute,
      onBack,
      setOnBack,
      headerLeftSlot,
      setHeaderLeftSlot,
      previousRoute: routeHistory[routeHistory.length - 2] ?? null,
      setPreviousRoute,
      routeHistory,
      setRouteHistory,
      connector,
      setConnector,
      resize,
      triggerResize,
    }),
    [
      chainType,
      open,
      setOpen,
      route,
      typedSetRoute,
      onBack,
      headerLeftSlot,
      routeHistory,
      setPreviousRoute,
      connector,
      resize,
      triggerResize,
    ]
  )

  const formValue: FormContextValue = useMemo(
    () => ({
      emailInput,
      setEmailInput,
      phoneInput,
      setPhoneInput,
      sendForm,
      setSendForm,
      buyForm,
      setBuyForm,
    }),
    [emailInput, phoneInput, sendForm, buyForm]
  )

  const signRequestValue: SignRequestContextValue = useMemo(() => ({ signRequest, setSignRequest }), [signRequest])

  const configValue: ConfigContextValue = useMemo(
    () => ({
      debugMode: debugModeOptions,
      publishableKey,
      uiConfig: safeUiConfig,
      walletConfig,
      overrides,
      thirdPartyAuth,
      onConnect,
      onDisconnect,
      chains,
    }),
    [
      debugModeOptions,
      publishableKey,
      safeUiConfig,
      walletConfig,
      overrides,
      thirdPartyAuth,
      onConnect,
      onDisconnect,
      chains,
    ]
  )

  const innerChildren = useMemo(
    () => (
      <>
        {hasWagmi && (
          <Suspense fallback={null}>
            <LazyEmbeddedWalletWagmiSync />
          </Suspense>
        )}
        {debugModeOptions.debugRoutes && (
          <pre
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              fontSize: '14px',
              color: 'gray',
              background: 'white',
              zIndex: 9999,
            }}
          >
            {JSON.stringify(
              routeHistory.map((item) =>
                Object.fromEntries(
                  Object.entries(item).map(([key, value]) => [
                    key,
                    typeof value === 'object' && value !== null ? '[object]' : value,
                  ])
                )
              ),
              null,
              2
            )}
          </pre>
        )}
        {children}
        <Suspense fallback={null}>
          <LazyConnectKitModal
            lang={ckLang}
            theme={ckTheme}
            mode={safeUiConfig.mode ?? ckMode}
            customTheme={ckCustomTheme}
          />
        </Suspense>
      </>
    ),
    [
      hasWagmi,
      debugModeOptions.debugRoutes,
      routeHistory,
      children,
      ckLang,
      ckTheme,
      safeUiConfig.mode,
      ckMode,
      ckCustomTheme,
    ]
  )

  const coreOpenfortConfig = useMemo(
    () => ({
      baseConfiguration: { publishableKey },
      shieldConfiguration: walletConfig
        ? {
            shieldPublishableKey: walletConfig.shieldPublishableKey,
            debug: debugModeOptions.shieldDebugMode,
            ...(walletConfig.passkeyDisplayName && {
              passkeyRpName: walletConfig.passkeyDisplayName,
            }),
          }
        : undefined,
      debug: debugModeOptions.openfortCoreDebugMode,
      overrides,
      thirdPartyAuth,
    }),
    [publishableKey, walletConfig, debugModeOptions, overrides, thirdPartyAuth]
  )

  const coreProviderTree = useMemo(
    () => (
      <CoreOpenfortProvider openfortConfig={coreOpenfortConfig} onConnect={onConnect} onDisconnect={onDisconnect}>
        {hasSolana ? (
          <Suspense fallback={null}>
            <SolanaContextProvider config={walletConfig!.solana!}>{innerChildren}</SolanaContextProvider>
          </Suspense>
        ) : (
          innerChildren
        )}
      </CoreOpenfortProvider>
    ),
    [coreOpenfortConfig, onConnect, onDisconnect, hasSolana, walletConfig, innerChildren]
  )

  return (
    <OpenfortContext.Provider value={configValue}>
      <ThemeStateContext.Provider value={themeValue}>
        <RoutingContext.Provider value={routingValue}>
          <SignRequestContext.Provider value={signRequestValue}>
            <FormContext.Provider value={formValue}>{coreProviderTree}</FormContext.Provider>
          </SignRequestContext.Provider>
        </RoutingContext.Provider>
      </ThemeStateContext.Provider>
    </OpenfortContext.Provider>
  )
}
