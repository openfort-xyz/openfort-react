'use client'

import { useEffect, useState } from 'react'
import { embeddedWalletId } from '../../constants/openfort'
import { useEthereumBridge } from '../../ethereum/OpenfortEthereumBridgeContext'
import styled from '../../styles/styled'
import { isAndroid } from '../../utils'
import { useOnUserReturn } from '../../utils/useOnUserReturn'
import { useConnectWithSiwe } from '../../wagmi/useConnectWithSiwe'
import { useExternalConnector } from '../../wallets/useExternalConnectors'
import { walletConfigs } from '../../wallets/walletConfigs'
import Button from '../Common/Button'
import FitText from '../Common/FitText'
import Loader from '../Common/Loading'
import WalletConnectNotConfigured, { useHasWalletConnect } from '../Common/WalletConnectNotConfigured'
import { routes } from '../Openfort/types'
import { useOpenfort } from '../Openfort/useOpenfort'
import { PageContent } from '../PageContent'

const states = {
  INIT: 'init',
  REDIRECT: 'redirect',
  CONNECTING: 'connecting',
  ERROR: 'error',
}

const DownloadFooter = styled.div`
  margin-top: 30px;
  color: var(--ck-body-color-muted);
`

const ConnectWithMobile: React.FC = () => {
  const { connector, setRoute } = useOpenfort()

  const walletId = Object.keys(walletConfigs).find(
    // where id is comma separated list
    (id) =>
      id
        .split(',')
        .map((i) => i.trim())
        .indexOf(connector.id) !== -1
  )

  const wallet = useExternalConnector(connector.id) || (walletId && walletConfigs[walletId]) || {}
  const bridge = useEthereumBridge()
  const hasWalletConnect = useHasWalletConnect()
  // Only consider external wallets as "connected" — ignore the embedded wallet connector
  const isExternalConnected =
    (bridge?.account?.isConnected && bridge?.account?.connector?.id !== embeddedWalletId) ?? false

  const [status, setStatus] = useState(isExternalConnected ? states.CONNECTING : states.INIT)
  const [description, setDescription] = useState<string | undefined>(undefined)

  const [hasReturned, setHasReturned] = useState(false)

  const { connectWithSiwe } = useConnectWithSiwe()

  const openApp = () => {
    const uri = wallet?.getWalletConnectDeeplink?.('')
    if (uri) {
      window.location.href = uri.replace('?uri=', '')
    } else {
      setStatus(states.ERROR)
      setDescription('Wallet does not support deeplink')
    }
  }

  useOnUserReturn(() => {
    setTimeout(() => {
      setHasReturned(true)
    }, 250)
  })

  useEffect(() => {
    if (hasReturned) {
      setHasReturned(false)
      if (isExternalConnected) {
        setStatus(states.CONNECTING)
      } else {
        setStatus(states.ERROR)
        setDescription('Connection failed or cancelled')
      }
    }
  }, [hasReturned, isExternalConnected])

  useEffect(() => {
    switch (status) {
      case states.INIT:
        break
      case states.CONNECTING:
        setDescription('Requesting signature to verify wallet...')
        connectWithSiwe({
          walletClientType: walletId,
          onConnect: () => setRoute(routes.CONNECTED),
          onError: (err) => {
            setStatus(states.ERROR)
            setDescription(err || 'Connection failed')
          },
        })
        break
    }
  }, [status])

  if (!hasWalletConnect) return <WalletConnectNotConfigured />

  return (
    <PageContent>
      <Loader
        header={`Connecting with ${connector.id.split(',')[0]}`}
        icon={wallet?.icon}
        isError={status === states.ERROR}
        description={description}
        onRetry={() => {
          setStatus(isExternalConnected ? states.CONNECTING : states.INIT)
          setDescription('')
        }}
      />
      {isExternalConnected ? (
        <Button
          onClick={() => {
            openApp()
          }}
        >
          Sign in App
        </Button>
      ) : (
        <Button
          onClick={() => {
            openApp()
          }}
        >
          Sign in App
        </Button>
      )}
      <DownloadFooter>
        <FitText>
          Don't have {wallet.name ?? connector.id.split(',')[0]} installed?{' '}
          <a
            style={{ marginLeft: 5 }}
            href={isAndroid() ? wallet?.downloadUrls?.android : wallet?.downloadUrls?.ios}
            target="_blank"
            rel="noreferrer"
          >
            GET
          </a>
        </FitText>
      </DownloadFooter>
    </PageContent>
  )
}

export default ConnectWithMobile
