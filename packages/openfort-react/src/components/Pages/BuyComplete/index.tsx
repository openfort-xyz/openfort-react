'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect } from 'react'

import { ExternalLinkIcon } from '../../../assets/icons.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { getExplorerUrl } from '../../../shared/utils/explorer.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import Button from '../../Common/Button/index.js'
import { ModalBody, ModalContent, ModalH1 } from '../../Common/Modal/styles.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { ContinueButtonWrapper, Section } from '../Buy/styles.js'

const BuyComplete = () => {
  const { setRoute, triggerResize } = useOpenfort()
  const chainType = useOpenfortCore((s) => s.chainType)

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

  const blockExplorerUrl = !address
    ? ''
    : chainType === ChainTypeEnum.SVM
      ? getExplorerUrl(ChainTypeEnum.SVM, { address, cluster: solanaWallet.cluster })
      : chainId
        ? getExplorerUrl(ChainTypeEnum.EVM, { chainId, address })
        : ''

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
