'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect } from 'react'

import { ExternalLinkIcon } from '../../../assets/icons'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { getExplorerUrl } from '../../../shared/utils/explorer'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Button from '../../Common/Button'
import { ModalBody, ModalContent, ModalH1 } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ContinueButtonWrapper, Section } from '../Buy/styles'

const BuyComplete = () => {
  const { setRoute, triggerResize } = useOpenfort()
  const { chainType } = useOpenfortCore()

  // Use chain-specific hooks
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  const isConnected = wallet.status === 'connected'
  const address = isConnected ? wallet.address : undefined
  const chainId = isConnected && chainType === ChainTypeEnum.EVM ? (wallet as typeof ethereumWallet).chainId : undefined

  // Trigger resize on mount
  useEffect(() => {
    triggerResize()
  }, [triggerResize])

  // Clean up sessionStorage (SSR-safe)
  useEffect(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('buyPopupOpen')
    }
  }, [])

  const handleDone = () => {
    setRoute(routes.CONNECTED)
  }

  const handleBack = () => {
    setRoute(routes.CONNECTED)
  }

  const blockExplorerUrl = address && chainId ? getExplorerUrl(ChainTypeEnum.EVM, { chainId, address }) : ''

  return (
    <PageContent onBack={handleBack}>
      <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
        <ModalH1>Provider Finished</ModalH1>

        <ModalBody style={{ marginTop: 24 }}>
          The provider flow has been completed. You can view your wallet on the block explorer to check your
          transactions.
        </ModalBody>

        <Section style={{ marginTop: 24 }}>
          {blockExplorerUrl && (
            <ContinueButtonWrapper style={{ marginTop: 0 }}>
              <Button
                variant="secondary"
                onClick={() => window.open(blockExplorerUrl, '_blank', 'noopener,noreferrer')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>View Wallet Transactions</span>
                  <ExternalLinkIcon />
                </div>
              </Button>
            </ContinueButtonWrapper>
          )}
          <ContinueButtonWrapper style={{ marginTop: blockExplorerUrl ? 4 : 0 }}>
            <Button variant="primary" onClick={handleDone}>
              Done
            </Button>
          </ContinueButtonWrapper>
        </Section>
      </ModalContent>
    </PageContent>
  )
}

export default BuyComplete
