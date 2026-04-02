'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEthereumBridge } from '../../ethereum/OpenfortEthereumBridgeContext'
import { useWalletConnectModal } from '../../hooks/useWalletConnectModal'
import { truncateEthAddress } from '../../utils'
import { useConnectWithSiwe } from '../../wagmi/useConnectWithSiwe'
import { useExternalConnector } from '../../wallets/useExternalConnectors'
import { CopyText } from '../Common/CopyToClipboard/CopyText'
import Loader from '../Common/Loading'
import { ModalBody } from '../Common/Modal/styles'
import { routes } from '../Openfort/types'
import { useOpenfort } from '../Openfort/useOpenfort'
import { PageContent } from '../PageContent'

const ConnectWithSiwe = () => {
  const bridge = useEthereumBridge()
  const isConnected = bridge?.account?.isConnected ?? false
  const address = bridge?.account?.address
  const ensName = bridge?.account?.ensName
  const { connector, setRoute } = useOpenfort()
  const wallet = useExternalConnector(connector.id)
  const { connectWithSiwe } = useConnectWithSiwe()

  const [error, setError] = useState<string | undefined>(undefined)
  const [description, setDescription] = useState<string | undefined>(undefined)

  const runSiwe = useCallback(() => {
    setDescription('Requesting signature to verify wallet...')
    connectWithSiwe({
      walletClientType: connector.id,
      onConnect: () => setRoute(routes.CONNECTED),
      onError: (err) => {
        setError(err || 'Connection failed')
        setDescription(undefined)
      },
    })
  }, [connectWithSiwe, connector.id, setRoute])

  useEffect(() => {
    if (isConnected) runSiwe()
  }, [isConnected, runSiwe])

  return (
    <PageContent>
      <ModalBody style={{ textAlign: 'center' }}>
        Connected with <CopyText value={address || ''}>{ensName ?? truncateEthAddress(address)}</CopyText>
      </ModalBody>
      <Loader
        header={'Sign in to your wallet'}
        icon={wallet?.icon}
        isError={!!error}
        description={error ?? description}
        onRetry={runSiwe}
      />
    </PageContent>
  )
}

const ConnectWithWalletConnect = () => {
  const { connector } = useOpenfort()
  const wallet = useExternalConnector(connector.id)
  const { open: openWalletConnectModal } = useWalletConnectModal()
  const [error, setError] = useState<string | undefined>(undefined)
  const hasOpenedRef = useRef(false)

  const openModal = useCallback(async () => {
    setError(undefined)
    const { error } = await openWalletConnectModal()
    if (error) setError(error)
  }, [openWalletConnectModal])

  useEffect(() => {
    if (hasOpenedRef.current) return
    hasOpenedRef.current = true
    openModal()
  }, [openModal])

  return (
    <PageContent>
      <Loader
        header={error ? 'Error connecting wallet.' : `Connecting...`}
        icon={wallet?.icon}
        isError={!!error}
        description={error}
        onRetry={openModal}
      />
    </PageContent>
  )
}

const ConnectWithQRCode = () => {
  const { connector, triggerResize } = useOpenfort()
  const bridge = useEthereumBridge()
  const isConnected = bridge?.account?.isConnected ?? false

  useEffect(() => {
    triggerResize()
  }, [isConnected])

  const wallet = useExternalConnector(connector.id)

  if (!wallet) return <Loader header={`Connector not found: ${connector.id}`} isError />

  if (isConnected) {
    return <ConnectWithSiwe />
  }

  return <ConnectWithWalletConnect />
}

export default ConnectWithQRCode
