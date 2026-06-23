'use client'

import { ChainTypeEnum, OAuthProvider } from '@openfort/openfort-js'
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'

type ValueOf<T> = T[keyof T]

import { useConnectionStrategy } from '../../core/ConnectionStrategyContext'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import type { CustomTheme, Languages, Mode, Theme } from '../../types'
import { logger } from '../../utils/logger'

const LazySwitchNetworks = lazy(() => import('../../wagmi/components/SwitchNetworks'))

import Modal from '../Common/Modal'
import { ConnectKitThemeProvider } from '../ConnectKitThemeProvider/ConnectKitThemeProvider'
import { routes, type SetRouteOptions } from '../Openfort/types'
import { useOpenfort } from '../Openfort/useOpenfort'
import About from '../Pages/About'
import { AssetInventory } from '../Pages/AssetInventory'
import { SolanaAssetInventory } from '../Pages/AssetInventory/SolanaAssetInventory'
import Buy from '../Pages/Buy'
import BuyComplete from '../Pages/BuyComplete'
import BuyProcessing from '../Pages/BuyProcessing'
import BuyProviderSelect from '../Pages/BuyProviderSelect'
import BuySelectProvider from '../Pages/BuySelectProvider'
import { Connected } from '../Pages/Connected'
import ConnectedSuccess from '../Pages/ConnectedSuccess'
import Connectors from '../Pages/Connectors'
import CreateGuestUserPage from '../Pages/CreateGuestUserPage'
import CreateWallet from '../Pages/CreateWallet'
import Deposit from '../Pages/Deposit'
import DepositCex from '../Pages/DepositCex'
import DepositCrypto from '../Pages/DepositCrypto'
import DepositWallet from '../Pages/DepositWallet'
import DownloadApp from '../Pages/DownloadApp'
import EmailLogin from '../Pages/EmailLogin'
import EmailOTP from '../Pages/EmailOTP'
import EmailVerification from '../Pages/EmailVerification'
import ExportKey from '../Pages/ExportKey'
import ForgotPassword from '../Pages/ForgotPassword'
import LinkEmail from '../Pages/LinkEmail'
import LinkedProvider from '../Pages/LinkedProvider'
import LinkedProviders from '../Pages/LinkedProviders'
import Loading from '../Pages/Loading'
import LoadWallets from '../Pages/LoadWallets'
import MobileConnectors from '../Pages/MobileConnectors'
import { NoAssetsAvailable } from '../Pages/NoAssetsAvailable'
import Onboarding from '../Pages/Onboarding'
import PhoneOTP from '../Pages/PhoneOTP'
import Profile from '../Pages/Profile'
import Providers from '../Pages/Providers'
import Receive from '../Pages/Receive'
import RecoverPage from '../Pages/Recover'
import RemoveLinkedProvider from '../Pages/RemoveLinkedProvider'
import SelectToken from '../Pages/SelectToken'
import { SolanaSelectToken } from '../Pages/SelectToken/SolanaSelectToken'
import SelectWalletToRecover from '../Pages/SelectWalletToRecover'
import Send from '../Pages/Send'
import { SolanaSend } from '../Pages/Send/SolanaSend'
import SendConfirmation from '../Pages/SendConfirmation'
import { SolanaSendConfirmation } from '../Pages/SendConfirmation/SolanaSendConfirmation'
import SignMessage from '../Pages/SignMessage'
import SocialProviders from '../Pages/SocialProviders'
import ConnectUsing from './ConnectUsing'
import ConnectWithMobile from './ConnectWithMobile'

type RoutePages = Partial<Record<ValueOf<typeof routes>, React.ReactNode>>

function buildSharedPages(): RoutePages {
  return {
    onboarding: <Onboarding />,
    about: <About />,
    loading: <Loading />,
    loadWallets: <LoadWallets />,
    connectedSuccess: <ConnectedSuccess />,
    createGuestUser: <CreateGuestUserPage />,
    socialProviders: <SocialProviders />,
    emailLogin: <EmailLogin />,
    emailOtp: <EmailOTP />,
    phoneOtp: <PhoneOTP />,
    forgotPassword: <ForgotPassword />,
    emailVerification: <EmailVerification />,
    linkEmail: <LinkEmail />,
    createWallet: <CreateWallet />,
    recoverWallets: <RecoverPage />,
    download: <DownloadApp />,
    connectors: <Connectors />,
    mobileConnectors: <MobileConnectors />,
    selectWalletToRecover: <SelectWalletToRecover />,
    providers: <Providers />,
    connect: <ConnectUsing />,
    connected: <Connected />,
    profile: <Profile />,
    linkedProviders: <LinkedProviders />,
    linkedProvider: <LinkedProvider />,
    removeLinkedProvider: <RemoveLinkedProvider />,
    connectWithMobile: <ConnectWithMobile />,
    noAssetsAvailable: <NoAssetsAvailable />,
    assetInventory: <AssetInventory />,
    send: <Send />,
    sendConfirmation: <SendConfirmation />,
    sendTokenSelect: <SelectToken isBuyFlow={false} />,
    buyTokenSelect: <SelectToken isBuyFlow={true} />,
    buySelectProvider: <BuySelectProvider />,
    buyProcessing: <BuyProcessing />,
    buyComplete: <BuyComplete />,
    buyProviderSelect: <BuyProviderSelect />,
    receive: <Receive />,
    buy: <Buy />,
    deposit: <Deposit />,
    depositCrypto: <DepositCrypto />,
    depositWallet: <DepositWallet />,
    depositCex: <DepositCex />,
    exportKey: <ExportKey />,
    signMessage: <SignMessage />,
    walletOverview: <Connected />,
  }
}

const CHAIN_PREFIXED_PAGES: Record<ChainTypeEnum, RoutePages> = {
  [ChainTypeEnum.EVM]: {
    'eth:connected': <Connected />,
    'eth:createWallet': <CreateWallet />,
    'eth:recoverWallet': <RecoverPage />,
    'eth:switchNetworks': (
      <Suspense fallback={null}>
        <LazySwitchNetworks />
      </Suspense>
    ),
    'eth:send': <Send />,
    'eth:receive': <Receive />,
    'eth:buy': <Buy />,
    'eth:connectors': <Connectors />,
  },
  [ChainTypeEnum.SVM]: {
    'sol:connected': <Connected />,
    'sol:createWallet': <CreateWallet />,
    'sol:recoverWallet': <RecoverPage />,
    'sol:send': <SolanaSend />,
    'sol:sendTokenSelect': <SolanaSelectToken />,
    'sol:sendConfirmation': <SolanaSendConfirmation />,
    'sol:receive': <Receive />,
    'sol:assetInventory': <SolanaAssetInventory />,
    // 'sol:wallets': <SolanaWallets />,
  },
}

const DEFAULT_CONNECTED_ROUTE: Record<ChainTypeEnum, ValueOf<typeof routes>> = {
  [ChainTypeEnum.EVM]: routes.ETH_CONNECTED,
  [ChainTypeEnum.SVM]: routes.SOL_CONNECTED,
}

const customThemeDefault: object = {}

const ConnectModal: React.FC<{
  mode?: Mode
  theme?: Theme
  customTheme?: CustomTheme
  lang?: Languages
}> = ({ mode = 'auto', theme = 'auto', customTheme = customThemeDefault, lang = 'en-US' }) => {
  const context = useOpenfort()
  const core = useOpenfortCore()
  const strategy = useConnectionStrategy()
  const state = useMemo(
    () => ({
      user: core.user,
      embeddedAccounts: core.embeddedAccounts,
      activeEmbeddedAddress: core.activeEmbeddedAddress,
      chainType: context.chainType,
      embeddedState: core.embeddedState,
    }),
    [core.user, core.embeddedAccounts, core.activeEmbeddedAddress, context.chainType, core.embeddedState]
  )
  const isConnected = strategy?.isConnected(state) ?? false
  const chainId = strategy?.getChainId()
  const chainIsSupported = chainId != null && context.chains.some((c) => c.id === chainId)

  // Auto-close only when the connect/auth flow completes: the modal was opened while
  // disconnected and then became connected. We latch the "opened-while-connected" state
  // on each open transition, so a chain switch — which briefly drops and restores the
  // connection while the modal is already open and connected — never triggers a close.
  const prevOpenRef = useRef(context.open)
  const openedConnectedRef = useRef(isConnected)
  const prevIsConnectedRef = useRef(isConnected)
  useEffect(() => {
    const justOpened = context.open && !prevOpenRef.current
    prevOpenRef.current = context.open
    if (justOpened) {
      openedConnectedRef.current = isConnected
      prevIsConnectedRef.current = isConnected
      return
    }
    const wasConnected = prevIsConnectedRef.current
    prevIsConnectedRef.current = isConnected
    if (!openedConnectedRef.current && !wasConnected && isConnected && context.open) {
      context.setOpen(false)
    }
  }, [isConnected, context.open])

  //if chain is unsupported we enforce a "switch chain" prompt
  const closeable = !(context.uiConfig.enforceSupportedChains && isConnected && !chainIsSupported)

  const route = context.route.route
  const chainType = context.chainType

  const sharedPages = useMemo(buildSharedPages, [])
  const pages = useMemo(() => ({ ...sharedPages, ...CHAIN_PREFIXED_PAGES[chainType] }), [sharedPages, chainType])
  const effectivePageId =
    route in pages && pages[route as ValueOf<typeof routes>] != null ? route : DEFAULT_CONNECTED_ROUTE[chainType]

  useEffect(() => {
    if (effectivePageId !== route) {
      context.setRoute(effectivePageId as SetRouteOptions)
    }
  }, [effectivePageId, route, context.setRoute])

  function hide() {
    context.setOpen(false)
  }

  // if auth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href.replace('?access_token=', '&access_token=')) // handle both ? and & cases
    const provider = url.searchParams.get('openfortAuthProviderUI')
    const emailVerification = url.searchParams.get('openfortEmailVerificationUI')
    const forgotPassword = url.searchParams.get('openfortForgotPasswordUI')

    logger.log('Checking for search parameters', { url, provider, emailVerification, forgotPassword })

    if (emailVerification) {
      context.setOpen(true)
      context.setRoute(routes.EMAIL_VERIFICATION)
      return
    }

    if (forgotPassword) {
      context.setOpen(true)
      context.setRoute(routes.FORGOT_PASSWORD)
      return
    }

    function isProvider(value: string | null): value is OAuthProvider {
      if (!value) return false
      return Object.values(OAuthProvider).includes(value as OAuthProvider)
    }

    if (isProvider(provider)) {
      logger.log('Found auth provider', provider)
      context.setOpen(true)
      context.setConnector({ id: provider, type: 'oauth' })
      context.setRoute({ route: routes.CONNECT, connectType: 'linkIfUserConnectIfNoUser' })
    }
  }, [])

  useEffect(() => context.setMode(mode), [mode])
  useEffect(() => context.setTheme(theme), [theme])
  useEffect(() => context.setCustomTheme(customTheme), [customTheme])
  useEffect(() => context.setLang(lang), [lang])

  /* When pulling data into WalletConnect, it prioritises the og:title tag over the title tag */
  useEffect(() => {
    const appName = context.uiConfig.appName ?? 'Openfort'
    if (!appName || !context.open) return

    const title = document.createElement('meta')
    title.setAttribute('property', 'og:title')
    title.setAttribute('content', appName)
    document.head.prepend(title)

    /*
    // OLD_TODO:  When pulling data into WalletConnect, figure out which icon gets used and replace with appIcon if available 
    const appIcon = getAppIcon();
    const icon = document.createElement('link');
    if (appIcon) {
      icon.setAttribute('rel', 'icon');
      icon.setAttribute('href', appIcon);
      document.head.prepend(icon);
    }*/

    return () => {
      document.head.removeChild(title)
      //if (appIcon) document.head.removeChild(icon);
    }
  }, [context.open])

  return (
    <ConnectKitThemeProvider theme={theme} customTheme={customTheme} mode={mode}>
      <Modal
        open={context.open}
        pages={pages}
        pageId={effectivePageId}
        onClose={closeable ? hide : undefined}
        // TODO: Implement onInfo
        // onInfo={
        //   showInfoButton ? () => context.setRoute(routes.ONBOARDING) : undefined
        // }
        // onBack={showBackButton ? onBack : undefined}
      />
    </ConnectKitThemeProvider>
  )
}

export default ConnectModal
