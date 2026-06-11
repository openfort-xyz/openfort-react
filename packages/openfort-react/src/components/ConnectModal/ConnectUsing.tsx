'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { logger } from '../../utils/logger'
import { useExternalConnector } from '../../wallets/useExternalConnectors'
import Alert from '../Common/Alert'
import { contentVariants } from '../Common/Modal'
import { routes } from '../Openfort/types'
import { useOpenfort } from '../Openfort/useOpenfort'
import ConnectWithInjector from './ConnectWithInjector'
import ConnectWithOAuth from './ConnectWithOAuth'
import ConnectWithQRCode from './ConnectWithQRCode'

const states = {
  QRCODE: 'qrcode',
  INJECTOR: 'injector',
}

/** Connector id must be a wallet connector (e.g. injected, walletConnect), not an Openfort account id. */
function isAccountId(id: string): boolean {
  return id.startsWith('acc_')
}

const ConnectUsing = () => {
  const context = useOpenfort()
  const connectorId = context.connector.id
  const isConnectorAccountId = isAccountId(connectorId)
  const effectiveConnectorId = isConnectorAccountId ? '' : connectorId
  const wallet = useExternalConnector(effectiveConnectorId)

  const isQrCode = !wallet?.isInstalled && wallet?.getWalletConnectDeeplink
  const isOauth = context.connector.type === 'oauth'
  const [status, setStatus] = useState(isQrCode ? states.QRCODE : states.INJECTOR)

  useEffect(() => {
    if (isConnectorAccountId) {
      context.setConnector({ id: '' })
      context.setRoute(routes.PROVIDERS)
    }
  }, [isConnectorAccountId, context])

  useEffect(() => {
    const connector = context.connector
    logger.log('ConnectUsing', { status, isQrCode, isOauth, connector })

    if (isOauth) return
    // if no provider, change to qrcode
    const checkProvider = async () => {
      const res = await wallet?.connector?.getProvider?.()
      if (!res) {
        setStatus(states.QRCODE)
        setTimeout(context.triggerResize, 10) // delay required here for modal to resize
      }
    }
    if (status === states.INJECTOR) checkProvider()
  }, [])

  if (isConnectorAccountId) return null
  if (isOauth) return <ConnectWithOAuth />
  if (!wallet) return <Alert>Connector not found {context.connector.id}</Alert>

  return (
    <AnimatePresence>
      {status === states.QRCODE && (
        <motion.div
          key={states.QRCODE}
          initial={'initial'}
          animate={'animate'}
          exit={'exit'}
          variants={contentVariants}
        >
          <ConnectWithQRCode />
        </motion.div>
      )}
      {status === states.INJECTOR && (
        <motion.div
          key={states.INJECTOR}
          initial={'initial'}
          animate={'animate'}
          exit={'exit'}
          variants={contentVariants}
        >
          <ConnectWithInjector
            switchConnectMethod={(_id?: string) => {
              //if (id) setId(id);
              setStatus(states.QRCODE)
              setTimeout(context.triggerResize, 10) // delay required here for modal to resize
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ConnectUsing
