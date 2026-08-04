'use client'

import { AnimatePresence, motion, type Variants } from 'framer-motion'
import type React from 'react'
import { type PropsWithChildren, useCallback, useEffect, useState } from 'react'
import { useTransition } from 'react-transition-state'
import { useConnectionStrategy } from '../../../core/ConnectionStrategyContext.js'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext.js'
import FocusTrap from '../../../hooks/useFocusTrap.js'
import useLocales from '../../../hooks/useLocales.js'
import useLockBodyScroll from '../../../hooks/useLockBodyScroll.js'
import usePrevious from '../../../hooks/usePrevious.js'
import { getRouteHeading } from '../../../localizations/routeHeadings.js'
import { ResetContainer } from '../../../styles/index.js'
import type { CustomTheme } from '../../../types.js'
import { flattenChildren, isMobile } from '../../../utils/index.js'
import { useExternalConnector } from '../../../wallets/useExternalConnectors.js'
import { useThemeContext } from '../../ConnectKitThemeProvider/ConnectKitThemeProvider.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfortConfig, useOpenfortRouting } from '../../Openfort/useOpenfort.js'
import FitText from '../FitText/index.js'
import Portal from '../Portal/index.js'
import { PageActivityProvider } from './pageActivity.js'
import {
  BackButton,
  BackgroundOverlay,
  BoxContainer,
  CloseButton,
  Container,
  ControllerContainer,
  InfoButton,
  InnerContainer,
  ModalContainer,
  ModalHeading,
  PageContainer,
  PageContents,
  TextWithHr,
} from './styles.js'
import { useContentBounds } from './useContentBounds.js'

/**
 * Marks a subtree inert while it finishes exiting.
 *
 * React 18 types `inert` as a string and React 19 as a boolean, and React 19
 * additionally treats the empty string as `false` and removes the attribute
 * (logging a warning as it does). Setting it through a ref sidesteps both the
 * typing split and that coercion, so the exiting page is genuinely inert — and
 * out of the tab order — in either runtime.
 */
const InertWhenInactive: React.FC<PropsWithChildren<{ active: boolean }>> = ({ active, children }) => {
  const setInert = useCallback(
    (node: HTMLDivElement | null) => {
      node?.toggleAttribute('inert', !active)
    },
    [active]
  )

  return (
    <div ref={setInert} aria-hidden={active ? undefined : true} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}

const InfoIcon = ({ ...props }) => (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 22 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M20 11C20 15.9706 15.9706 20 11 20C6.02944 20 2 15.9706 2 11C2 6.02944 6.02944 2 11 2C15.9706 2 20 6.02944 20 11ZM22 11C22 17.0751 17.0751 22 11 22C4.92487 22 0 17.0751 0 11C0 4.92487 4.92487 0 11 0C17.0751 0 22 4.92487 22 11ZM11.6445 12.7051C11.6445 13.1348 11.3223 13.4678 10.7744 13.4678C10.2266 13.4678 9.92578 13.1885 9.92578 12.6191V12.4795C9.92578 11.4268 10.4951 10.8574 11.2686 10.3203C12.2031 9.67578 12.665 9.32129 12.665 8.59082C12.665 7.76367 12.0205 7.21582 11.043 7.21582C10.3232 7.21582 9.80762 7.57031 9.45312 8.16113C9.38282 8.24242 9.32286 8.32101 9.2667 8.39461C9.04826 8.68087 8.88747 8.8916 8.40039 8.8916C8.0459 8.8916 7.66992 8.62305 7.66992 8.15039C7.66992 7.96777 7.70215 7.7959 7.75586 7.61328C8.05664 6.625 9.27051 5.75488 11.1182 5.75488C12.9336 5.75488 14.5234 6.71094 14.5234 8.50488C14.5234 9.7832 13.7822 10.417 12.7402 11.1045C11.999 11.5986 11.6445 11.9746 11.6445 12.5762V12.7051ZM11.9131 15.5625C11.9131 16.1855 11.376 16.6797 10.7529 16.6797C10.1299 16.6797 9.59277 16.1748 9.59277 15.5625C9.59277 14.9395 10.1191 14.4453 10.7529 14.4453C11.3867 14.4453 11.9131 14.9287 11.9131 15.5625Z"
      fill="currentColor"
    />
  </svg>
)
const CloseIcon = ({ ...props }) => (
  <motion.svg width={14} height={14} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <title>Close</title>
    <path d="M1 13L13 1M1 1L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </motion.svg>
)
const BackIcon = ({ ...props }) => (
  <motion.svg width={9} height={16} viewBox="0 0 9 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <title>Back</title>
    <path d="M8 1L1 8L8 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </motion.svg>
)

const contentTransitionDuration = 0.22

/**
 * How long a page stays mounted after it stops being the active page: the 200ms
 * exit keyframes in styles.ts plus the 16.6ms delay on `.exit`, rounded up.
 */
const pageExitDurationMs = 240

/** Class names on {@link PageContainer} selecting the enter/exit keyframes. */
type PageAnimation = 'active' | 'active-scale-up' | 'exit' | 'exit-scale-down'

/**
 * Keeps the page navigated away from mounted for the length of its exit
 * animation, so only two pages ever exist in the DOM: the active one and, mid
 * route change, the one fading out behind it.
 *
 * @param pageId Route id of the page that should be visible.
 * @param mounted Whether the modal itself is on screen. Route changes made
 *   while it is closed swap instantly, with no page left animating out.
 * @returns The active page id and the page id currently animating out, if any.
 */
function usePageTransition(pageId: string, mounted: boolean) {
  const [stack, setStack] = useState<{ active: string; outgoing: string | null }>({
    active: pageId,
    outgoing: null,
  })

  if (stack.active !== pageId) {
    setStack({ active: pageId, outgoing: mounted ? stack.active : null })
  }

  const { outgoing } = stack
  useEffect(() => {
    if (outgoing === null) return
    const timer = setTimeout(() => {
      setStack((prev) => (prev.outgoing === outgoing ? { active: prev.active, outgoing: null } : prev))
    }, pageExitDurationMs)
    return () => clearTimeout(timer)
  }, [outgoing])

  return stack
}

export const contentVariants: Variants = {
  initial: {
    zIndex: 2,
    opacity: 0,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: contentTransitionDuration * 0.75,
      delay: contentTransitionDuration * 0.25,
      ease: [0.26, 0.08, 0.25, 1],
    },
  },
  exit: {
    zIndex: 1,
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    left: ['50%', '50%'],
    x: ['-50%', '-50%'],
    transition: {
      duration: contentTransitionDuration,
      ease: [0.26, 0.08, 0.25, 1],
    },
  },
}

type ModalProps = {
  open?: boolean
  /** Route id to page element. Keys are route ids; a missing route renders nothing. */
  pages: Partial<Record<string, React.ReactNode>>
  pageId: string
  positionInside?: boolean
  inline?: boolean
  onClose?: () => void
  onInfo?: () => void

  demo?: {
    theme: string
    mode?: string
    customTheme: CustomTheme
  }
}
const Modal: React.FC<ModalProps> = ({ open, pages, pageId, positionInside, inline, demo, onClose, onInfo }) => {
  const routing = useOpenfortRouting()
  const { uiConfig } = useOpenfortConfig()
  const themeContext = useThemeContext()
  const mobile = isMobile()

  const wallet = useExternalConnector(routing.connector?.id)

  const walletInfo = {
    name: wallet?.name,
    shortName: wallet?.shortName ?? wallet?.name,
    icon: wallet?.iconConnector ?? wallet?.icon,
    iconShape: wallet?.iconShape ?? 'circle',
    iconShouldShrink: wallet?.iconShouldShrink,
  }

  const locales = useLocales({
    CONNECTORNAME: walletInfo?.name ?? 'UNKNOWN CONNECTOR',
  })

  const [state, setOpen] = useTransition({
    timeout: 160,
    preEnter: true,
    mountOnEnter: true,
    unmountOnExit: true,
  })
  const mounted = !(state === 'exited' || state === 'unmounted')
  const rendered = state === 'preEnter' || state !== 'exiting'

  const route = routing.route.route
  const currentDepth = route === routes.PROVIDERS ? 0 : route === routes.DOWNLOAD ? 2 : 1
  const prevDepth = usePrevious(currentDepth, currentDepth)
  const { active: activePageId, outgoing: outgoingPageId } = usePageTransition(pageId, mounted)
  useLockBodyScroll(!positionInside ? mounted : false)

  // A chain switch, a viewport-class change or an explicit triggerResize can move
  // the content box without remounting the page, so each re-triggers a measurement.
  const strategy = useConnectionStrategy()
  const bridge = useEthereumBridge()
  const chainId = strategy?.getChainId() ?? bridge?.account?.chain?.id ?? bridge?.chainId
  const switchChain = bridge?.switchChain?.switchChain
  const { dimensions, contentRef, inTransition, clearBounds, clearTransition } = useContentBounds([
    chainId,
    switchChain,
    mobile,
    uiConfig,
    routing.resize,
  ])

  useEffect(() => {
    setOpen(open)
    if (open) clearTransition()
  }, [open, setOpen, clearTransition])

  useEffect(() => {
    if (!mounted) {
      clearBounds()
      return
    }

    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose()
    }
    document.addEventListener('keydown', listener)
    return () => {
      document.removeEventListener('keydown', listener)
    }
  }, [mounted, onClose, clearBounds])

  const dimensionsCSS = {
    '--height': dimensions.height,
    '--width': dimensions.width,
  } as React.CSSProperties

  // A wallet without a deeplink, or one already installed, connects through the
  // injector flow — which also owns the failure states. The rest pair by QR code.
  const showsQrCode = !!wallet?.getWalletConnectDeeplink && !wallet.isInstalled
  const heading = getRouteHeading(route, locales, {
    name: walletInfo.name,
    connectorId: wallet?.connector?.id,
    showsQrCode,
  })

  const customPages: Partial<Record<string, React.ReactElement>> = uiConfig.customPageComponents ?? {}

  function renderPage(key: string | null, active: boolean) {
    if (key === null) return null
    const page = customPages[key] ?? pages[key]
    if (page == null) return null

    const animation: PageAnimation = active
      ? currentDepth > prevDepth
        ? 'active-scale-up'
        : 'active'
      : currentDepth < prevDepth
        ? 'exit-scale-down'
        : 'exit'

    const pageActive = active && rendered

    return (
      <Page key={key} animation={animation} initial={!positionInside && state !== 'entered'}>
        {/* Only the active page is measured: the outgoing one is absolutely positioned
            while it fades out, so the modal sizes itself to the page arriving. */}
        <PageContents
          ref={active ? contentRef : undefined}
          aria-hidden={pageActive ? undefined : true}
          style={{ pointerEvents: pageActive ? 'auto' : 'none' }}
        >
          <InertWhenInactive active={pageActive}>
            <PageActivityProvider active={pageActive}>{page}</PageActivityProvider>
          </InertWhenInactive>
        </PageContents>
      </Page>
    )
  }

  const Content = (
    <ResetContainer
      $useTheme={demo?.theme ?? themeContext.theme}
      $useMode={demo?.mode ?? themeContext.mode}
      $customTheme={demo?.customTheme ?? themeContext.customTheme}
    >
      <ModalContainer
        role="dialog"
        style={{
          pointerEvents: rendered ? 'auto' : 'none',
          position: positionInside ? 'absolute' : undefined,
        }}
      >
        {!inline && <BackgroundOverlay $active={rendered} onClick={onClose} $blur={uiConfig.overlayBlur} />}
        <Container style={dimensionsCSS} initial={false}>
          <div
            style={{
              pointerEvents: inTransition ? 'all' : 'none', // Block interaction while transitioning
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'var(--width)',
              zIndex: 9,
              transition: 'width 200ms ease',
            }}
          />
          <BoxContainer className={`${rendered && 'active'}`}>
            <ControllerContainer>
              {onClose && (
                <CloseButton aria-label={flattenChildren(locales.close).toString()} onClick={onClose}>
                  <CloseIcon />
                </CloseButton>
              )}
              <div
                style={{
                  position: 'absolute',
                  top: 23,
                  left: 20,
                  minWidth: 32,
                  minHeight: 32,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <AnimatePresence>
                  {routing.onBack ? (
                    <BackButton
                      disabled={inTransition}
                      aria-label={flattenChildren(locales.back).toString()}
                      key="backButton"
                      onClick={routing.onBack}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: mobile ? 0 : 0.1,
                        delay: mobile ? 0.01 : 0,
                      }}
                    >
                      <BackIcon />
                    </BackButton>
                  ) : routing.headerLeftSlot ? (
                    <motion.div
                      key="headerLeftSlot"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      style={{ display: 'inline-flex' }}
                    >
                      {routing.headerLeftSlot}
                    </motion.div>
                  ) : (
                    onInfo &&
                    !uiConfig.hideQuestionMarkCTA && (
                      <InfoButton
                        disabled={inTransition}
                        aria-label={flattenChildren(locales.moreInformation).toString()}
                        key="infoButton"
                        onClick={onInfo}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{
                          duration: mobile ? 0 : 0.1,
                          delay: mobile ? 0.01 : 0,
                        }}
                      >
                        <InfoIcon />
                      </InfoButton>
                    )
                  )}
                </AnimatePresence>
              </div>
            </ControllerContainer>

            <ModalHeading>
              <AnimatePresence>
                <motion.div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 52,
                    right: 52,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                  key={`${route}-${'signedIn'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: mobile ? 0 : 0.17,
                    delay: mobile ? 0.01 : 0,
                  }}
                >
                  <FitText>{heading}</FitText>
                </motion.div>
              </AnimatePresence>
            </ModalHeading>

            <InnerContainer>
              {renderPage(outgoingPageId, false)}
              {renderPage(activePageId, true)}
            </InnerContainer>
          </BoxContainer>
        </Container>
      </ModalContainer>
    </ResetContainer>
  )
  return (
    <>
      {mounted &&
        (positionInside ? (
          Content
        ) : (
          <Portal>
            <FocusTrap>{Content}</FocusTrap>
          </Portal>
        ))}
    </>
  )
}

type PageProps = {
  children?: React.ReactNode
  animation: PageAnimation
  /** Play no animation because the modal itself is still opening. */
  initial: boolean
}

const Page: React.FC<PageProps> = ({ children, animation, initial }) => (
  <PageContainer
    className={animation}
    style={{
      animationDuration: initial ? '0ms' : undefined,
      animationDelay: initial ? '0ms' : undefined,
    }}
  >
    {children}
  </PageContainer>
)

export const OrDivider = ({ children, hideHr }: { children?: React.ReactNode; hideHr?: boolean }) => {
  const locales = useLocales()
  return (
    <TextWithHr $disableHr={hideHr}>
      <span>{children ?? locales.or}</span>
    </TextWithHr>
  )
}

export default Modal
