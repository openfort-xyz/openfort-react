'use client'

import { OAuthProvider } from '@openfort/openfort-js'
import { useEffect, useMemo, useRef } from 'react'
import { useConnectionStrategy } from '../../core/ConnectionStrategyContext.js'
import { useOpenfortCore } from '../../openfort/useOpenfort.js'
import type { CustomTheme, Languages, Mode, Theme } from '../../types.js'
import { logger } from '../../utils/logger.js'
import Modal from '../Common/Modal/index.js'
import { ConnectKitThemeProvider } from '../ConnectKitThemeProvider/ConnectKitThemeProvider.js'
import { routes, type SetRouteOptions } from '../Openfort/types.js'
import { useOpenfort } from '../Openfort/useOpenfort.js'
import { chainPrefixedPages, defaultConnectedRoute, sharedPages } from './pageRegistry.js'

type ValueOf<T> = T[keyof T]

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
  }, [isConnected, context.open, context.setOpen])

  //if chain is unsupported we enforce a "switch chain" prompt
  const closeable = !(context.uiConfig.enforceSupportedChains && isConnected && !chainIsSupported)

  const route = context.route.route
  const chainType = context.chainType

  const pages = useMemo(() => ({ ...sharedPages, ...chainPrefixedPages[chainType] }), [chainType])
  const effectivePageId =
    route in pages && pages[route as ValueOf<typeof routes>] != null ? route : defaultConnectedRoute[chainType]

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
  }, [context.setOpen, context.setRoute, context.setConnector])

  useEffect(() => context.setMode(mode), [mode, context.setMode])
  useEffect(() => context.setTheme(theme), [theme, context.setTheme])
  useEffect(() => context.setCustomTheme(customTheme), [customTheme, context.setCustomTheme])
  useEffect(() => context.setLang(lang), [lang, context.setLang])

  /* When pulling data into WalletConnect, it prioritises the og:title tag over the title tag */
  useEffect(() => {
    const appName = context.uiConfig.appName ?? 'Openfort'
    if (!appName || !context.open) return

    const title = document.createElement('meta')
    title.setAttribute('property', 'og:title')
    title.setAttribute('content', appName)
    document.head.prepend(title)

    // TODO: Set an og:image meta tag from the app icon once it is known which
    // icon WalletConnect surfaces to the wallet.

    return () => {
      document.head.removeChild(title)
    }
  }, [context.open, context.uiConfig.appName])

  return (
    <ConnectKitThemeProvider theme={theme} customTheme={customTheme} mode={mode}>
      <Modal open={context.open} pages={pages} pageId={effectivePageId} onClose={closeable ? hide : undefined} />
    </ConnectKitThemeProvider>
  )
}

export default ConnectModal
