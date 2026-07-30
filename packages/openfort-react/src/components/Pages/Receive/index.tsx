'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect } from 'react'
import Logos from '../../../assets/logos.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useEthereumBridge } from '../../../ethereum/OpenfortEthereumBridgeContext.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import { CopyIconButton } from '../../Common/CopyToClipboard/CopyIconButton.js'
import CustomQRCode from '../../Common/CustomQRCode/index.js'
import { ModalHeading } from '../../Common/Modal/styles.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { AddressField, AddressRow, AddressSection, Label, NetworkInfo, QRWrapper, ReceiveContent } from './styles.js'

function formatSolanaCluster(cluster: string): string {
  if (cluster === 'mainnet-beta') return 'Mainnet'
  return cluster.charAt(0).toUpperCase() + cluster.slice(1)
}

const Receive = () => {
  const context = useOpenfort()
  const { route, chains } = context
  const currentRoute = route?.route ?? ''
  const isSolanaRoute = currentRoute.startsWith('sol:')
  const { chainType } = useOpenfortCore()
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const bridge = useEthereumBridge()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  // Use embedded wallet if available, otherwise fall back to bridge (external wallet)
  const embeddedConnected = wallet.status === 'connected'
  const bridgeConnected = chainType === ChainTypeEnum.EVM && !!(bridge?.account.isConnected && bridge?.account.address)
  const isConnected = embeddedConnected || bridgeConnected
  const address = embeddedConnected ? wallet.address : bridgeConnected ? bridge?.account.address : undefined
  const chainId =
    embeddedConnected && chainType === ChainTypeEnum.EVM
      ? (wallet as typeof ethereumWallet).chainId
      : bridgeConnected
        ? bridge?.chainId
        : undefined
  const chain = chains.find((c) => c.id === chainId)

  const qrValue = address || ''

  const networkLabel =
    isConnected && chainType === ChainTypeEnum.SVM && solanaWallet.cluster
      ? formatSolanaCluster(solanaWallet.cluster)
      : chain?.name
        ? `${chain.name}${chainId ? ` · Chain ID: ${chainId}` : ''}`
        : chainId
          ? `Chain ID: ${chainId}`
          : null

  const { uiConfig: options } = context
  const renderLogo = () => {
    if (options?.logo) {
      if (typeof options.logo === 'string') {
        return <img src={options.logo} alt="Logo" style={{ width: '100%' }} />
      }
      return options.logo
    }
    return <Logos.Openfort />
  }

  useEffect(() => {
    const timer = setTimeout(() => context.triggerResize(), 100)
    return () => clearTimeout(timer)
  }, [address, context])

  return (
    <PageContent onBack={isSolanaRoute ? routes.SOL_CONNECTED : routes.CONNECTED}>
      <ReceiveContent>
        <ModalHeading>Receive money</ModalHeading>

        {address && (
          <QRWrapper>
            <CustomQRCode value={qrValue} image={<div style={{ padding: 10 }}>{renderLogo()}</div>} />
          </QRWrapper>
        )}

        <AddressSection>
          <Label>Your wallet address</Label>
          <AddressRow>
            <AddressField>{address ?? '--'}</AddressField>
            <CopyIconButton value={address ?? ''} />
          </AddressRow>
        </AddressSection>

        {networkLabel && <NetworkInfo>Network: {networkLabel}</NetworkInfo>}
      </ReceiveContent>
    </PageContent>
  )
}

export default Receive
