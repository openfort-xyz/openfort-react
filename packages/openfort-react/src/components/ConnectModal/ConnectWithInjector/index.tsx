'use client'

import { AnimatePresence, type Variants } from 'framer-motion'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { AlertIcon, RetryIconCircle, TickIcon } from '../../../assets/icons'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext'
import { useUser } from '../../../hooks/openfort/useUser'
import useLocales from '../../../hooks/useLocales'
import { useRouteProps } from '../../../hooks/useRouteProps'
import { detectBrowser, isWalletConnectConnector } from '../../../utils'
import { logger } from '../../../utils/logger'
import { useConnectWithSiwe } from '../../../wagmi/useConnectWithSiwe'
import { useExternalConnector } from '../../../wallets/useExternalConnectors'
import Alert from '../../Common/Alert'
import BrowserIcon from '../../Common/BrowserIcon'
import Button from '../../Common/Button'
import { ModalBody, ModalContent, ModalContentContainer, ModalH1, ModalHeading } from '../../Common/Modal/styles'
import SquircleSpinner from '../../Common/SquircleSpinner'
import Tooltip from '../../Common/Tooltip'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import CircleSpinner from './CircleSpinner'
import { ConnectingAnimation, ConnectingContainer, Container, Content, RetryButton, RetryIconContainer } from './styles'

const states = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting',
  FAILED: 'failed',
  REJECTED: 'rejected',
  NOTCONNECTED: 'notconnected',
  UNAVAILABLE: 'unavailable',
  SIWE: 'siwe',
  RECOVER_ADDRESS_MISMATCH: 'recoverAddressMismatch',
}

const contentVariants: Variants = {
  initial: {
    willChange: 'transform,opacity',
    position: 'relative',
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    position: 'relative',
    opacity: 1,
    scale: 1,
    transition: {
      ease: [0.16, 1, 0.3, 1],
      duration: 0.4,
      delay: 0.05,
      position: { delay: 0 },
    },
  },
  exit: {
    position: 'absolute',
    opacity: 0,
    scale: 0.95,
    transition: {
      ease: [0.16, 1, 0.3, 1],
      duration: 0.3,
    },
  },
}

const ConnectWithInjector: React.FC<{
  switchConnectMethod: (id?: string) => void
  forceState?: typeof states
}> = ({ forceState }) => {
  const { setOpen } = useOpenfort()
  const bridge = useEthereumBridge()
  const { connectWithSiwe } = useConnectWithSiwe()
  const props = useRouteProps(routes.CONNECT)
  const { linkedAccounts, user } = useUser()
  const { triggerResize, connector: c } = useOpenfort()
  const id = c.id
  const wallet = useExternalConnector(id)

  const onConnect = useCallback(() => {
    setStatus(states.CONNECTED)
    setTimeout(() => {
      triggerResize()
    }, 250)
    setTimeout(() => {
      setOpen(false)
    }, 1250)
  }, [setOpen, triggerResize])

  const handleConnectSettled = useCallback(
    async (
      walletItem: NonNullable<typeof wallet>,
      connectResult?: { accounts: readonly `0x${string}`[]; chainId: number }
    ) => {
      if (!bridge) return
      const disconnect = bridge.disconnect
      const getConnectorAccounts = bridge.getConnectorAccounts

      if (props.connectType === 'recover' && getConnectorAccounts) {
        const acc = await getConnectorAccounts(walletItem.connector)
        if (acc.some((v) => v === props.wallet?.address)) {
          onConnect()
        } else {
          setStatus(states.RECOVER_ADDRESS_MISMATCH)
          await disconnect()
        }
        return
      }

      // Only skip SIWE when user is logged in AND this wallet is already linked (reconnecting)
      const userWallets = user
        ? linkedAccounts?.filter(
            (acc) =>
              acc.walletClientType === walletItem.connector?.name?.toLowerCase() ||
              acc.walletClientType === walletItem.connector?.id
          )
        : []
      if (userWallets && userWallets.length > 0 && getConnectorAccounts) {
        const acc = await getConnectorAccounts(walletItem.connector)
        if (acc.some((v) => userWallets.some((w) => w.accountId === v))) {
          onConnect()
          return
        }
      }

      setStatus(states.SIWE)
      const addressFromResult = connectResult?.accounts?.[0]
      connectWithSiwe({
        address: addressFromResult,
        connectorType: walletItem.connector?.type,
        walletClientType: walletItem.connector?.id,
        onError: (error, _errorType) => {
          logger.error('[ConnectWithInjector] SIWE failed:', error)
          disconnect()
          setStatus(states.FAILED)
        },
        onConnect: () => {
          onConnect()
        },
      })
    },
    [
      bridge,
      user,
      linkedAccounts,
      onConnect,
      props.connectType,
      'wallet' in props ? props.wallet?.address : undefined,
      connectWithSiwe,
    ]
  )

  const handleConnectError = useCallback((error: { code?: number; message?: string }) => {
    setShowTryAgainTooltip(true)
    setTimeout(() => setShowTryAgainTooltip(false), 3500)
    if (error?.code !== undefined) {
      switch (error.code) {
        case -32002:
          setStatus(states.NOTCONNECTED)
          break
        case 4001:
          setStatus(states.REJECTED)
          break
        default:
          setStatus(states.FAILED)
          break
      }
    } else if (error?.message) {
      if (error.message === 'User rejected request') {
        setStatus(states.REJECTED)
      } else {
        setStatus(states.FAILED)
      }
    } else {
      setStatus(states.FAILED)
    }
  }, [])

  const walletInfo = {
    name: wallet?.name,
    shortName: wallet?.shortName ?? wallet?.name,
    icon: wallet?.iconConnector ?? wallet?.icon,
    iconShape: wallet?.iconShape ?? 'circle',
    iconShouldShrink: wallet?.iconShouldShrink,
  }

  const [showTryAgainTooltip, setShowTryAgainTooltip] = useState(false)

  const browser = detectBrowser()

  const downloadUrls: Partial<Record<string, string>> = wallet?.downloadUrls ?? {}
  const extensionUrl = downloadUrls[browser]

  const [firstDownload] = Object.keys(downloadUrls)
  const suggestedExtension = firstDownload
    ? {
        name: firstDownload,
        // Capitalise first letter, but this might be better suited as a lookup table
        label: firstDownload.charAt(0).toUpperCase() + firstDownload.slice(1),
        url: downloadUrls[firstDownload],
      }
    : undefined

  const [status, setStatus] = useState(
    forceState ? forceState : !wallet?.isInstalled ? states.UNAVAILABLE : states.CONNECTING
  )

  const locales = useLocales({
    CONNECTORNAME: walletInfo.name ?? 'UNKNOWN CONNECTOR',
    CONNECTORSHORTNAME: walletInfo.shortName ?? walletInfo.name ?? 'UNKNOWN CONNECTOR',
    SUGGESTEDEXTENSIONBROWSER: suggestedExtension?.label ?? 'your browser',
  })

  const runConnect = useCallback(async () => {
    if (!bridge || !wallet?.isInstalled || !wallet?.connector) {
      setStatus(states.UNAVAILABLE)
      return
    }
    if (bridge.account.isConnected) {
      await bridge.disconnect()
    }
    setStatus(states.CONNECTING)
    try {
      let connectResult: { accounts: readonly `0x${string}`[]; chainId: number } | undefined
      if (bridge.connectAsync) {
        const result = await bridge.connectAsync({ connector: wallet.connector })
        connectResult =
          result && typeof result === 'object' && 'accounts' in result
            ? (result as { accounts: readonly `0x${string}`[]; chainId: number })
            : undefined
      } else {
        bridge.connect({ connector: wallet.connector })
        return
      }
      if (!wallet) {
        setStatus(states.FAILED)
        logger.error('[ConnectWithInjector] No wallet found after connect')
        return
      }
      logger.log('[ConnectWithInjector] Connect type is:', props.connectType)
      await handleConnectSettled(wallet, connectResult)
    } catch (err: unknown) {
      logger.error('[ConnectWithInjector] Connection error', err instanceof Error ? err.message : err)
      handleConnectError(
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: number; message?: string })
          : {
              message:
                err instanceof Error && err.message === 'User rejected request'
                  ? 'User rejected request'
                  : 'Connection failed',
            }
      )
    }
    setTimeout(triggerResize, 100)
  }, [bridge, wallet, props.connectType, handleConnectSettled, handleConnectError, triggerResize])

  let connectTimeout: ReturnType<typeof setTimeout>
  useEffect(() => {
    if (status === states.UNAVAILABLE) return

    // UX: Give user time to see the UI before opening the extension
    connectTimeout = setTimeout(runConnect, 600)
    return () => {
      clearTimeout(connectTimeout)
    }
  }, [])

  /* Timeout functionality if necessary
  let expiryTimeout: any;
  useEffect(() => {
    if (status === states.EXPIRING) {
      expiryTimeout = setTimeout(
        () => {
          if (expiryTimer <= 0) {
            setStatus(states.FAILED);
            setExpiryTimer(expiryDefault);
          } else {
            setExpiryTimer(expiryTimer - 1);
          }
        },
        expiryTimer === 9 ? 1500 : 1000 // Google: Chronostasis
      );
    }
    return () => {
      clearTimeout(expiryTimeout);
    };
  }, [status, expiryTimer]);
  */

  if (!wallet) {
    return (
      <PageContent>
        <Container>
          <ModalHeading>Invalid State</ModalHeading>
          <ModalContent>
            <Alert>No connectors match the id given. This state should never happen.</Alert>
          </ModalContent>
        </Container>
      </PageContent>
    )
  }

  // TODO: Derive this from a connector capability flag rather than matching
  // WalletConnect by id.
  if (isWalletConnectConnector(wallet?.connector.id)) {
    return (
      <PageContent>
        <Container>
          <ModalHeading>Invalid State</ModalHeading>
          <ModalContent>
            <Alert>WalletConnect does not have an injection flow. This state should never happen.</Alert>
          </ModalContent>
        </Container>
      </PageContent>
    )
  }

  const hasError = status === states.FAILED || status === states.REJECTED || status === states.RECOVER_ADDRESS_MISMATCH

  return (
    <PageContent>
      <Container>
        <ConnectingContainer>
          <ConnectingAnimation $shake={hasError} $circle={walletInfo.iconShape === 'circle'}>
            <AnimatePresence>
              {hasError && (
                <RetryButton
                  aria-label="Retry"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.1 }}
                  onClick={runConnect}
                >
                  <RetryIconContainer>
                    <Tooltip open={showTryAgainTooltip && hasError} message={locales.tryAgainQuestion} xOffset={-6}>
                      <RetryIconCircle />
                    </Tooltip>
                  </RetryIconContainer>
                </RetryButton>
              )}
            </AnimatePresence>
            {walletInfo.iconShape === 'circle' ? (
              <CircleSpinner
                logo={
                  status === states.UNAVAILABLE ? (
                    <div
                      style={{
                        transform: 'scale(1.14)',
                        position: 'relative',
                        width: '100%',
                      }}
                    >
                      {walletInfo.icon}
                    </div>
                  ) : (
                    walletInfo.icon
                  )
                }
                smallLogo={walletInfo.iconShouldShrink}
                connecting={status === states.CONNECTING || status === states.SIWE}
                unavailable={status === states.UNAVAILABLE}
              />
            ) : (
              <SquircleSpinner
                logo={
                  status === states.UNAVAILABLE ? (
                    <div
                      style={{
                        transform: 'scale(1.14)',
                        position: 'relative',
                        width: '100%',
                      }}
                    >
                      {walletInfo.icon}
                    </div>
                  ) : (
                    walletInfo.icon
                  )
                }
                connecting={status === states.CONNECTING || status === states.SIWE}
                //unavailable={status === states.UNAVAILABLE}
              />
            )}
            {/* </Tooltip> */}
          </ConnectingAnimation>
        </ConnectingContainer>
        <ModalContentContainer>
          <AnimatePresence initial={false}>
            {status === states.FAILED && (
              <Content
                key={states.FAILED}
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={contentVariants}
              >
                <ModalContent>
                  <ModalH1 $error>
                    <AlertIcon />
                    {locales.injectionScreen_failed_h1}
                  </ModalH1>
                  <ModalBody>{locales.injectionScreen_failed_p}</ModalBody>
                </ModalContent>

                {/* Reason: Coinbase Wallet does not expose a QRURI when extension is installed */}
                {/* 
                {wallet?.getWalletConnectDeeplink &&
                  wallet.id !== 'coinbaseWalletSDK' && (
                    <>
                      <OrDivider />
                      <Button
                        icon={<Scan />}
                        onClick={() => switchConnectMethod(id)}
                      >
                        {locales.scanTheQRCode}
                      </Button>
                    </>
                  )}
                   */}
              </Content>
            )}
            {status === states.REJECTED && (
              <Content
                key={states.REJECTED}
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={contentVariants}
              >
                <ModalContent
                  style={{
                    paddingBottom: 28,
                  }}
                >
                  <ModalH1>{locales.injectionScreen_rejected_h1}</ModalH1>
                  <ModalBody>{locales.injectionScreen_rejected_p}</ModalBody>
                </ModalContent>

                {/* Reason: Coinbase Wallet does not expose a QRURI when extension is installed */}
                {/* 
                {wallet?.getWalletConnectDeeplink &&
                  wallet.id !== 'coinbaseWalletSDK' && (
                    <>
                      <OrDivider />
                      <Button
                        icon={<Scan />}
                        onClick={() => switchConnectMethod(id)}
                      >
                        {locales.scanTheQRCode}
                      </Button>
                    </>
                  )}
                   */}
              </Content>
            )}

            {status === states.RECOVER_ADDRESS_MISMATCH && (
              <Content
                key={states.RECOVER_ADDRESS_MISMATCH}
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={contentVariants}
              >
                <ModalContent
                  style={{
                    paddingBottom: 28,
                  }}
                >
                  <ModalH1>Wallet mismatch</ModalH1>
                  <ModalBody>The wallet address you are trying to recover does not belong to this user.</ModalBody>
                </ModalContent>
              </Content>
            )}
            {status === states.CONNECTING && (
              <Content
                key={states.CONNECTING}
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={contentVariants}
              >
                <ModalContent
                  style={{
                    paddingBottom: 28,
                  }}
                >
                  <ModalH1>
                    {wallet.connector.id === 'injected'
                      ? locales.injectionScreen_connecting_injected_h1
                      : locales.injectionScreen_connecting_h1}
                  </ModalH1>
                  <ModalBody>
                    {wallet.connector.id === 'injected'
                      ? locales.injectionScreen_connecting_injected_p
                      : locales.injectionScreen_connecting_p}
                  </ModalBody>
                </ModalContent>
              </Content>
            )}

            {status === states.SIWE && (
              <Content
                key={states.SIWE}
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={contentVariants}
              >
                <ModalContent
                  style={{
                    paddingBottom: 28,
                  }}
                >
                  <ModalH1>Confirm in your wallet</ModalH1>
                  <ModalBody>
                    Sign the message in your wallet to confirm that you own this wallet and complete the connection.
                  </ModalBody>
                </ModalContent>
              </Content>
            )}
            {status === states.CONNECTED && (
              <Content
                key={states.CONNECTED}
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={contentVariants}
              >
                <ModalContent>
                  <ModalH1 $valid>
                    <TickIcon /> Connected
                  </ModalH1>
                  <ModalBody>Successfully connected with {walletInfo.name}.</ModalBody>
                </ModalContent>
              </Content>
            )}
            {status === states.NOTCONNECTED && (
              <Content
                key={states.NOTCONNECTED}
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={contentVariants}
              >
                <ModalContent>
                  <ModalH1>{locales.injectionScreen_notconnected_h1}</ModalH1>
                  <ModalBody>{locales.injectionScreen_notconnected_p}</ModalBody>
                </ModalContent>
              </Content>
            )}
            {status === states.UNAVAILABLE && (
              <Content
                key={states.UNAVAILABLE}
                initial={'initial'}
                animate={'animate'}
                exit={'exit'}
                variants={contentVariants}
              >
                {!extensionUrl ? (
                  <>
                    <ModalContent style={{ paddingBottom: 12 }}>
                      <ModalH1>{locales.injectionScreen_unavailable_h1}</ModalH1>
                      <ModalBody>{locales.injectionScreen_unavailable_p}</ModalBody>
                    </ModalContent>

                    {!wallet.isInstalled && suggestedExtension && (
                      <Button href={suggestedExtension?.url} icon={<BrowserIcon browser={suggestedExtension?.name} />}>
                        Install on {suggestedExtension?.label}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <ModalContent style={{ paddingBottom: 18 }}>
                      <ModalH1>{locales.injectionScreen_install_h1}</ModalH1>
                      <ModalBody>{locales.injectionScreen_install_p}</ModalBody>
                    </ModalContent>
                    {/*
                    {(wallet.getWalletConnectDeeplink &&
                    (!wallet.isInstalled && extensionUrl)) && <OrDivider />}

                    {wallet.getWalletConnectDeeplink && (
                      <Button icon={<Scan />} onClick={switchConnectMethod}>
                        {locales.scanTheQRCode}
                      </Button>
                    )}
                    */}
                    {!wallet.isInstalled && extensionUrl && (
                      <Button href={extensionUrl} icon={<BrowserIcon />}>
                        {locales.installTheExtension}
                      </Button>
                    )}
                  </>
                )}
              </Content>
            )}
          </AnimatePresence>
        </ModalContentContainer>
      </Container>
    </PageContent>
  )
}

export default ConnectWithInjector
