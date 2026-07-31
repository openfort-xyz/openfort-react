'use client'

import { OAuthProvider } from '@openfort/openfort-js'
import { memo, useEffect, useMemo, useRef } from 'react'
import { useConnectionStrategy } from '../../core/ConnectionStrategyContext.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import type { CustomTheme, Languages, Mode, Theme } from '../../types.js'
import { logger } from '../../utils/logger.js'
import Modal from '../Common/Modal/index.js'
import { ConnectKitThemeProvider } from '../ConnectKitThemeProvider/ConnectKitThemeProvider.js'
import { routes, type SetRouteOptions } from '../Openfort/types.js'
import { useOpenfort, useOpenfortConfig, useOpenfortRouting, useOpenfortTheme } from '../Openfort/useOpenfort.js'
import { chainPrefixedPages, defaultConnectedRoute, sharedPages } from './pageRegistry.js'

type ValueOf<T> = T[keyof T]

const customThemeDefault: object = {}

const ConnectModal: React.FC<{
  mode?: Mode
  theme?: Theme
  customTheme?: CustomTheme
  lang?: Languages
}> = ({ mode = 'auto', theme = 'auto', customTheme = customThemeDefault, lang = 'en-US' }) => {
  const routing = useOpenfortRouting()
  const { signRequest, setSignRequest } = useOpenfort()
  const { chains, uiConfig } = useOpenfortConfig()
  const themeControls = useOpenfortTheme()
  const user = useOpenfortCore((s) => s.user)
  const embeddedAccounts = useOpenfortCore((s) => s.embeddedAccounts)
  const activeEmbeddedAddress = useOpenfortCore((s) => s.activeEmbeddedAddress)
  const embeddedState = useOpenfortCore((s) => s.embeddedState)
  const strategy = useConnectionStrategy()
  const state = useMemo(
    () => ({
      user,
      embeddedAccounts,
      activeEmbeddedAddress,
      chainType: routing.chainType,
      embeddedState,
    }),
    [user, embeddedAccounts, activeEmbeddedAddress, routing.chainType, embeddedState]
  )
  const isConnected = strategy?.isConnected(state) ?? false
  const chainId = strategy?.getChainId()
  const chainIsSupported = chainId != null && chains.some((c) => c.id === chainId)

  // Auto-close only when the connect/auth flow completes: the modal was opened while
  // disconnected and then became connected. We latch the "opened-while-connected" state
  // on each open transition, so a chain switch — which briefly drops and restores the
  // connection while the modal is already open and connected — never triggers a close.
  const prevOpenRef = useRef(routing.open)
  const openedConnectedRef = useRef(isConnected)
  const prevIsConnectedRef = useRef(isConnected)
  useEffect(() => {
    const justOpened = routing.open && !prevOpenRef.current
    prevOpenRef.current = routing.open
    if (justOpened) {
      openedConnectedRef.current = isConnected
      prevIsConnectedRef.current = isConnected
      return
    }
    const wasConnected = prevIsConnectedRef.current
    prevIsConnectedRef.current = isConnected
    const hasPendingSignature = routing.route.route === routes.SIGN_MESSAGE && signRequest !== null
    if (!hasPendingSignature && !openedConnectedRef.current && !wasConnected && isConnected && routing.open) {
      routing.setOpen(false)
    }
  }, [isConnected, routing.open, routing.route.route, routing.setOpen, signRequest])

  //if chain is unsupported we enforce a "switch chain" prompt
  const closeable = !(uiConfig.enforceSupportedChains && isConnected && !chainIsSupported)

  const route = routing.route.route
  const chainType = routing.chainType

  const pages = useMemo(() => ({ ...sharedPages, ...chainPrefixedPages[chainType] }), [chainType])
  const effectivePageId =
    route in pages && pages[route as ValueOf<typeof routes>] != null ? route : defaultConnectedRoute[chainType]

  useEffect(() => {
    if (effectivePageId !== route) {
      routing.setRoute(effectivePageId as SetRouteOptions)
    }
  }, [effectivePageId, route, routing.setRoute])

  function hide() {
    signRequest?.reject(new Error('User rejected the signature request'))
    setSignRequest(null)
    routing.setOpen(false)
  }

  // if auth redirect
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href.replace('?access_token=', '&access_token=')) // handle both ? and & cases
    const provider = url.searchParams.get('openfortAuthProviderUI')
    const emailVerification = url.searchParams.get('openfortEmailVerificationUI')
    const forgotPassword = url.searchParams.get('openfortForgotPasswordUI')

    logger.log('Checking for authentication search parameters', {
      hasProvider: !!provider,
      hasEmailVerification: !!emailVerification,
      hasForgotPassword: !!forgotPassword,
    })

    if (emailVerification) {
      routing.setOpen(true)
      routing.setRoute(routes.EMAIL_VERIFICATION)
      return
    }

    if (forgotPassword) {
      routing.setOpen(true)
      routing.setRoute(routes.FORGOT_PASSWORD)
      return
    }

    function isProvider(value: string | null): value is OAuthProvider {
      if (!value) return false
      return Object.values(OAuthProvider).includes(value as OAuthProvider)
    }

    if (isProvider(provider)) {
      logger.log('Found auth provider', provider)
      routing.setOpen(true)
      routing.setConnector({ id: provider, type: 'oauth' })
      routing.setRoute({ route: routes.CONNECT, connectType: 'linkIfUserConnectIfNoUser' })
    }
  }, [routing.setOpen, routing.setRoute, routing.setConnector])

  useEffect(() => themeControls.setMode(mode), [mode, themeControls.setMode])
  useEffect(() => themeControls.setTheme(theme), [theme, themeControls.setTheme])
  useEffect(() => themeControls.setCustomTheme(customTheme), [customTheme, themeControls.setCustomTheme])
  useEffect(() => themeControls.setLang(lang), [lang, themeControls.setLang])

  /* When pulling data into WalletConnect, it prioritises the og:title tag over the title tag */
  useEffect(() => {
    const appName = uiConfig.appName ?? 'Openfort'
    if (!appName || !routing.open) return

    const title = document.createElement('meta')
    title.setAttribute('property', 'og:title')
    title.setAttribute('content', appName)
    document.head.prepend(title)

    // TODO: Set an og:image meta tag from the app icon once it is known which
    // icon WalletConnect surfaces to the wallet.

    return () => {
      document.head.removeChild(title)
    }
  }, [routing.open, uiConfig.appName])

  return (
    <ConnectKitThemeProvider theme={theme} customTheme={customTheme} mode={mode}>
      <Modal open={routing.open} pages={pages} pageId={effectivePageId} onClose={closeable ? hide : undefined} />
    </ConnectKitThemeProvider>
  )
}

/**
 * Memoized so form state changing in OpenfortProvider — every keystroke in an
 * email or amount field — does not re-render the modal shell around the page
 * that owns the field.
 */
export default memo(ConnectModal)
