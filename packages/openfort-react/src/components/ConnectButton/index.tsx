import { ChainTypeEnum } from '@openfort/openfort-js'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import type React from 'react'
import { useConnectionStrategy } from '../../core/ConnectionStrategyContext'
import { useUI } from '../../hooks/openfort/useUI'
import useIsMounted from '../../hooks/useIsMounted'
import useLocales from '../../hooks/useLocales'
import { useResolvedIdentity } from '../../hooks/useResolvedIdentity'
import { useOpenfortCore } from '../../openfort/useOpenfort'
import { ResetContainer } from '../../styles'
import type { CustomTheme, Mode, Theme } from '../../types'
import { formatAddress } from '../../utils/format'
import { logger } from '../../utils/logger'
import { Balance } from '../BalanceButton'
import Avatar from '../Common/Avatar'
import ThemedButton, { ThemeContainer } from '../Common/ThemedButton'
import { routes } from '../Openfort/types'
import { useOpenfort } from '../Openfort/useOpenfort'
import { IconContainer, TextContainer, UnsupportedNetworkContainer } from './styles'

const contentVariants: Variants = {
  initial: {
    zIndex: 2,
    opacity: 0,
    x: '-100%',
  },
  animate: {
    opacity: 1,
    x: 0.1,
    transition: {
      duration: 0.4,
      ease: [0.25, 1, 0.5, 1],
    },
  },
  exit: {
    zIndex: 1,
    opacity: 0,
    x: '-100%',
    pointerEvents: 'none',
    position: 'absolute',
    transition: {
      duration: 0.4,
      ease: [0.25, 1, 0.5, 1],
    },
  },
}

const addressVariants: Variants = {
  initial: {
    zIndex: 2,
    opacity: 0,
    x: '100%',
  },
  animate: {
    x: 0.2,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 1, 0.5, 1],
    },
  },
  exit: {
    zIndex: 1,
    x: '100%',
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    transition: {
      duration: 0.4,
      ease: [0.25, 1, 0.5, 1],
    },
  },
}

const textVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 1, 0.5, 1],
    },
  },
  exit: {
    position: 'absolute',
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 1, 0.5, 1],
    },
  },
}

type Hash = `0x${string}`

type ConnectButtonRendererProps = {
  children?: (renderProps: {
    show?: () => void
    hide?: () => void
    unsupported: boolean
    isConnected: boolean
    isConnecting: boolean
    address?: Hash
    truncatedAddress?: string
    ensName?: string
    chainId?: number
  }) => React.ReactNode
}

const ConnectButtonRenderer: React.FC<ConnectButtonRendererProps> = ({ children }) => {
  const isMounted = useIsMounted()
  const context = useOpenfort()
  const { open, close, isOpen } = useUI()

  const { user, chainType, embeddedAccounts, activeEmbeddedAddress, embeddedState } = useOpenfortCore()
  const strategy = useConnectionStrategy()
  const strategyState = { user, embeddedAccounts, activeEmbeddedAddress, embeddedState, chainType }

  const isConnected = strategy?.isConnected(strategyState) ?? false
  const address = isConnected ? (strategy?.getAddress(strategyState) as Hash | undefined) : undefined
  const chainId = isConnected && chainType === ChainTypeEnum.EVM ? strategy?.getChainId() : undefined

  const chainIsSupported = chainId != null && context.chains.some((c) => c.id === chainId)

  const identity = useResolvedIdentity({
    address: address ?? '',
    chainType: chainType,
    ensChainId: chainId ?? 0,
    enabled: isConnected && !!address,
  })
  const ensName = identity.status === 'success' ? identity.name : undefined

  function hide() {
    close()
  }

  function show() {
    open()
    context.setRoute(isConnected ? routes.CONNECTED : routes.PROVIDERS)
  }

  if (!children) return null
  if (!isMounted) return null

  return (
    <>
      {children({
        show,
        hide,
        unsupported: !chainIsSupported,
        isConnected: isConnected,
        isConnecting: isOpen,
        address: address,
        truncatedAddress: address ? formatAddress(address, chainType) : undefined,
        ensName: ensName ?? undefined,
        chainId,
      })}
    </>
  )
}

ConnectButtonRenderer.displayName = 'OpenfortButton.Custom'

const ConnectedLabel = ({ separator }: { separator?: string }) => {
  const { user, chainType, embeddedAccounts, activeEmbeddedAddress, embeddedState, isLoadingAccounts, walletStatus } =
    useOpenfortCore()
  const strategy = useConnectionStrategy()
  const strategyState = { user, embeddedAccounts, activeEmbeddedAddress, embeddedState, chainType }

  const isLoading = isLoadingAccounts || walletStatus.status === 'creating' || walletStatus.status === 'connecting'
  const isConnected = strategy?.isConnected(strategyState) ?? false
  const address = strategy?.getAddress(strategyState)

  if (isLoading) return 'Loading...'
  if (!isConnected || !address) {
    if (!user) return 'Loading user...'
    return 'Not connected'
  }

  return separator ? `${address.slice(0, 6)}${separator}${address.slice(-4)}` : formatAddress(address, chainType)
}

function OpenfortButtonInner({
  label,
  showAvatar,
  separator,
}: {
  label?: string
  showAvatar?: boolean
  separator?: string
}) {
  const locales = useLocales({})
  const { user, chainType, embeddedAccounts, activeEmbeddedAddress, embeddedState } = useOpenfortCore()
  const context = useOpenfort()
  const strategy = useConnectionStrategy()
  const strategyState = { user, embeddedAccounts, activeEmbeddedAddress, embeddedState, chainType }

  const isConnected = strategy?.isConnected(strategyState) ?? false
  const address = isConnected ? strategy?.getAddress(strategyState) : undefined
  const chainId = isConnected && chainType === ChainTypeEnum.EVM ? strategy?.getChainId() : undefined

  const chainIsSupported = chainId != null && context.chains.some((c) => c.id === chainId)
  const showUnsupportedWarning = chainType === ChainTypeEnum.EVM && !chainIsSupported

  const identity = useResolvedIdentity({
    address: address ?? '',
    chainType: chainType,
    ensChainId: chainId ?? 0,
    enabled: isConnected && !!address,
  })
  const ensName = identity.status === 'success' ? identity.name : undefined

  const defaultLabel = locales.connectWallet

  return (
    <AnimatePresence initial={false}>
      {user || (isConnected && address) ? (
        <TextContainer
          key={'connectedText'}
          initial={'initial'}
          animate={'animate'}
          exit={'exit'}
          variants={addressVariants}
          style={{
            height: 40,
          }}
        >
          {showAvatar && (
            <IconContainer>
              <AnimatePresence initial={false}>
                {showUnsupportedWarning && (
                  <UnsupportedNetworkContainer initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <title>Unsupported network</title>
                      <path
                        d="M1.68831 13.5H12.0764C13.1026 13.5 13.7647 12.7197 13.7647 11.763C13.7647 11.4781 13.6985 11.1863 13.5462 10.9149L8.34225 1.37526C8.02445 0.791754 7.45505 0.5 6.88566 0.5C6.31627 0.5 5.73364 0.791754 5.42246 1.37526L0.225108 10.9217C0.0728291 11.1863 0 11.4781 0 11.763C0 12.7197 0.662083 13.5 1.68831 13.5ZM6.88566 8.8048C6.49503 8.8048 6.27655 8.5809 6.26331 8.1738L6.16399 5.0595C6.15075 4.64562 6.44869 4.34708 6.87904 4.34708C7.30278 4.34708 7.61396 4.6524 7.60071 5.06628L7.5014 8.16701C7.48154 8.5809 7.26305 8.8048 6.88566 8.8048ZM6.88566 11.3492C6.44207 11.3492 6.07792 11.0303 6.07792 10.5757C6.07792 10.1211 6.44207 9.80219 6.88566 9.80219C7.32926 9.80219 7.69341 10.1143 7.69341 10.5757C7.69341 11.0371 7.32264 11.3492 6.88566 11.3492Z"
                        fill="currentColor"
                      />
                    </svg>
                  </UnsupportedNetworkContainer>
                )}
              </AnimatePresence>
              <Avatar size={24} address={address} />
            </IconContainer>
          )}

          <div
            style={{
              position: 'relative',
              paddingRight: showAvatar ? 1 : 0,
            }}
          >
            <AnimatePresence initial={false}>
              <TextContainer
                key="ckTruncatedAddress"
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={textVariants}
                style={{
                  position: ensName ? 'absolute' : 'relative',
                }}
              >
                <ConnectedLabel separator={separator} />
              </TextContainer>
            </AnimatePresence>
          </div>
        </TextContainer>
      ) : (
        <TextContainer
          key="connectWalletText"
          initial={'initial'}
          animate={'animate'}
          exit={'exit'}
          variants={contentVariants}
          style={{
            height: 40,
          }}
        >
          {label ? label : defaultLabel}
        </TextContainer>
      )}
    </AnimatePresence>
  )
}

type OpenfortButtonProps = {
  // Options
  label?: string
  showBalance?: boolean
  showAvatar?: boolean

  // Theming
  theme?: Theme
  mode?: Mode
  customTheme?: CustomTheme

  // Events
  onClick?: (open: () => void) => void
}

/**
 * Connect button component. Shows balance, avatar, and chain when connected;
 * opens connect modal when disconnected. Use `OpenfortButton.Custom` for custom render.
 *
 * @example
 * ```tsx
 * <OpenfortButton />
 * <OpenfortButton label="Connect" showAvatar />
 * <OpenfortButton.Custom>{(props) => <CustomButton {...props} />}</OpenfortButton.Custom>
 * ```
 */
export function OpenfortButton({
  // Options
  label,
  showBalance = false,
  showAvatar = true,

  // Theming
  theme,
  mode,
  customTheme,

  // Events
  onClick,
}: OpenfortButtonProps) {
  const isMounted = useIsMounted()
  const context = useOpenfort()
  const { open } = useUI()
  const { user, chainType, embeddedAccounts, activeEmbeddedAddress, embeddedState } = useOpenfortCore()
  const strategy = useConnectionStrategy()
  const strategyState = { user, embeddedAccounts, activeEmbeddedAddress, embeddedState, chainType }

  const isConnected = strategy?.isConnected(strategyState) ?? false
  const chainId = isConnected && chainType === ChainTypeEnum.EVM ? strategy?.getChainId() : undefined

  const chainIsSupported = chainId != null && context.chains.some((c) => c.id === chainId)

  const separator = ['web95', 'rounded', 'minimal'].includes(theme ?? context.uiConfig.theme ?? '') ? '....' : undefined

  if (!isMounted) return null

  const shouldShowBalance = showBalance && (chainType === ChainTypeEnum.SVM || chainIsSupported)
  const willShowBalance = isConnected && shouldShowBalance

  return (
    <ResetContainer
      $useTheme={theme ?? context.uiConfig.theme}
      $useMode={mode ?? context.mode}
      $customTheme={customTheme ?? context.uiConfig.customTheme}
    >
      <ThemeContainer
        onClick={() => {
          logger.log('OpenfortButton click', {
            chainType,
            isConnected,
            address: strategy?.getAddress(strategyState),
          })
          if (onClick) {
            onClick(() => open())
          } else {
            open()
          }
        }}
      >
        {shouldShowBalance && (
          <AnimatePresence initial={false}>
            {willShowBalance && (
              <motion.div
                key={'balance'}
                initial={{
                  opacity: 0,
                  x: '100%',
                  width: 0,
                  marginRight: 0,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  width: 'auto',
                  marginRight: -24,
                  transition: {
                    duration: 0.4,
                    ease: [0.25, 1, 0.5, 1],
                  },
                }}
                exit={{
                  opacity: 0,
                  x: '100%',
                  width: 0,
                  marginRight: 0,
                  transition: {
                    duration: 0.4,
                    ease: [0.25, 1, 0.5, 1],
                  },
                }}
              >
                <ThemedButton
                  variant={'secondary'}
                  theme={theme ?? context.uiConfig.theme}
                  mode={mode ?? context.mode}
                  customTheme={customTheme ?? context.uiConfig.customTheme}
                  style={{ overflow: 'hidden' }}
                >
                  <motion.div style={{ paddingRight: 24 }}>
                    <Balance hideSymbol />
                  </motion.div>
                </ThemedButton>
              </motion.div>
            )}
          </AnimatePresence>
        )}
        <ThemedButton
          theme={theme ?? context.uiConfig.theme}
          mode={mode ?? context.mode}
          customTheme={customTheme ?? context.uiConfig.customTheme}
          style={
            shouldShowBalance && showBalance && isConnected && (theme === 'retro' || context.uiConfig.theme === 'retro')
              ? {
                  /* Special fix for the retro theme... not happy about this one */
                  boxShadow: 'var(--ck-connectbutton-balance-connectbutton-box-shadow)',
                  borderRadius: 'var(--ck-connectbutton-balance-connectbutton-border-radius)',
                  overflow: 'hidden',
                }
              : {
                  overflow: 'hidden',
                }
          }
        >
          <OpenfortButtonInner separator={separator} showAvatar={showAvatar} label={label} />
        </ThemedButton>
      </ThemeContainer>
    </ResetContainer>
  )
}

OpenfortButton.Custom = ConnectButtonRenderer
