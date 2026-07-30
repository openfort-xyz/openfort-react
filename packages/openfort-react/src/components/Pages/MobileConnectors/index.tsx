'use client'

import type React from 'react'
import useLocales from '../../../hooks/useLocales.js'
import { useWalletConnectModal } from '../../../hooks/useWalletConnectModal.js'
import { useExternalConnectors } from '../../../wallets/useExternalConnectors.js'
import { walletConfigs } from '../../../wallets/walletConfigs.js'
import { CopyButton } from '../../Common/CopyToClipboard/CopyButton.js'
import { ModalContent } from '../../Common/Modal/styles.js'
import { ScrollArea } from '../../Common/ScrollArea/index.js'
import { Spinner } from '../../Common/Spinner/index.js'
import WalletConnectNotConfigured, { useHasWalletConnect } from '../../Common/WalletConnectNotConfigured/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { Container, WalletIcon, WalletItem, WalletLabel, WalletList } from './styles.js'

const MoreIcon = (
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <title>More wallets icon</title>
    <path d="M30 42V19M19 30.5H42" stroke="var(--ck-body-color-muted)" strokeWidth="3" strokeLinecap="round" />
  </svg>
)

const MobileConnectors: React.FC = () => {
  const context = useOpenfort()
  const locales = useLocales()

  const { open: openW3M, isOpen: isOpenW3M } = useWalletConnectModal()
  const wallets = useExternalConnectors()
  const hasWalletConnect = useHasWalletConnect()

  // filter out installed wallets
  const walletsToDisplay = Object.entries(walletConfigs).filter(([walletId, wallet]) => {
    if (wallets.find((w) => w.connector.id === walletId)) return false
    if (!wallet.getWalletConnectDeeplink) return false
    return true
  })

  const connectWallet = (walletId: string) => {
    context.setRoute(routes.CONNECT_WITH_MOBILE)
    context.setConnector({ id: walletId })
  }

  // Every wallet on this page connects through WalletConnect deeplinks
  if (!hasWalletConnect) return <WalletConnectNotConfigured />

  return (
    <PageContent width={312} onBack={routes.PROVIDERS}>
      <Container>
        <ModalContent style={{ paddingBottom: 0 }}>
          <ScrollArea height={340}>
            <WalletList>
              {walletsToDisplay
                .sort(
                  // sort by name
                  ([idA, walletA], [idB, walletB]) => {
                    const nameA = walletA.name ?? walletA.shortName ?? idA
                    const nameB = walletB.name ?? walletB.shortName ?? idB
                    return nameA.localeCompare(nameB)
                  }
                )
                .filter(([walletId]) => !(walletId === 'coinbaseWallet' || walletId === 'com.coinbase.wallet'))
                .map(([walletId, wallet], i) => {
                  const { name, shortName, iconConnector, icon } = wallet
                  return (
                    <WalletItem
                      key={walletId}
                      onClick={() => connectWallet(walletId)}
                      style={{
                        animationDelay: `${i * 50}ms`,
                      }}
                    >
                      <WalletIcon $outline={true}>{iconConnector ?? icon}</WalletIcon>
                      <WalletLabel>{shortName ?? name}</WalletLabel>
                    </WalletItem>
                  )
                })}
              <WalletItem onClick={openW3M} $waiting={isOpenW3M}>
                <WalletIcon style={{ background: 'var(--ck-body-background-secondary)' }}>
                  {isOpenW3M ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '50%',
                        }}
                      >
                        <Spinner />
                      </div>
                    </div>
                  ) : (
                    MoreIcon
                  )}
                </WalletIcon>
                <WalletLabel>{locales.more}</WalletLabel>
              </WalletItem>
            </WalletList>
          </ScrollArea>
        </ModalContent>
        {context.uiConfig.walletConnectCTA !== 'modal' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              paddingTop: 8,
            }}
          >
            <CopyButton value="">{locales.copyToClipboard}</CopyButton>
          </div>
        )}
      </Container>
    </PageContent>
  )
}

export default MobileConnectors
