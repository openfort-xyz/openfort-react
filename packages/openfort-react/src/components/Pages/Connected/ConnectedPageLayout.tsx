/**
 * Shared layout for Ethereum and Solana connected pages.
 * Renders avatar, address, balance, and action buttons with chain-specific content.
 */

import type React from 'react'
import { ModalBody, ModalContent, ModalH1 } from '../../Common/Modal/styles'
import PoweredByFooter from '../../Common/PoweredByFooter'
import { ActionButtonsContainer, AvatarContainer, AvatarInner, BalanceContainer, LoadingBalance } from './styles'

type ConnectedPageLayoutProps = {
  address: string
  displayName: React.ReactNode
  avatar: React.ReactNode
  balance: React.ReactNode | null
  actions: React.ReactNode
  beforeAvatar?: React.ReactNode
  hideBalance?: boolean
  isBalanceLoading?: boolean
  /** When true and address is empty, show Loading... instead of noWalletFallback */
  isAddressLoading?: boolean
  noWalletFallback: React.ReactNode
  /** Optional content after actions (e.g. AnimatePresence for testnet message) */
  afterActions?: React.ReactNode
}

export const ConnectedPageLayout: React.FC<ConnectedPageLayoutProps> = ({
  address,
  displayName,
  avatar,
  balance,
  actions,
  beforeAvatar,
  hideBalance,
  isBalanceLoading,
  isAddressLoading,
  noWalletFallback,
  afterActions,
}) => {
  return (
    <ModalContent style={{ paddingBottom: 6, gap: 6 }}>
      {address ? (
        <>
          <AvatarContainer>
            <AvatarInner>
              {beforeAvatar}
              {avatar}
            </AvatarInner>
          </AvatarContainer>
          <ModalH1>{displayName}</ModalH1>
          {hideBalance ? null : (
            <ModalBody>
              <BalanceContainer>
                {isBalanceLoading ? (
                  <LoadingBalance
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    &nbsp;
                  </LoadingBalance>
                ) : (
                  balance
                )}
              </BalanceContainer>
              <ActionButtonsContainer>{actions}</ActionButtonsContainer>
              {afterActions}
            </ModalBody>
          )}
        </>
      ) : isAddressLoading ? (
        <LoadingBalance
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          Loading...
        </LoadingBalance>
      ) : (
        noWalletFallback
      )}
      <PoweredByFooter />
    </ModalContent>
  )
}
