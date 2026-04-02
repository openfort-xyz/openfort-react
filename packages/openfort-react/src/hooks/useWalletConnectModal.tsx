'use client'

import { useCallback, useRef, useState } from 'react'
import { useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext'
import { isWalletConnectConnector } from '../utils'
import { logger } from '../utils/logger'

export function useWalletConnectModal() {
  const bridge = useEthereumBridge()
  const [isOpen, setIsOpen] = useState(false)
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge
  const connectingRef = useRef(false)

  const open = useCallback(async () => {
    if (connectingRef.current) return {}
    connectingRef.current = true

    const currentBridge = bridgeRef.current

    const w3mcss = document.createElement('style')
    w3mcss.textContent = `w3m-modal, wcm-modal{ --wcm-z-index: 2147483647; --w3m-z-index:2147483647; }`
    document.head.appendChild(w3mcss)

    const removeChild = () => {
      if (document.head.contains(w3mcss)) {
        document.head.removeChild(w3mcss)
      }
    }

    const connectors = currentBridge?.connectors ?? []
    const clientConnector = connectors.find((c) => isWalletConnectConnector(c.id))

    if (clientConnector && currentBridge?.connectAsync) {
      try {
        currentBridge.reset()
        setIsOpen(true)
        await currentBridge.connectAsync({ connector: clientConnector })
        setIsOpen(false)
        removeChild()
        connectingRef.current = false
        return {}
      } catch (err) {
        setIsOpen(false)
        removeChild()
        connectingRef.current = false
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('Connection request reset')) {
          currentBridge.reset()
          return { error: 'Connection cancelled' }
        }
        logger.log('WalletConnect', err)
        return { error: 'Connection failed' }
      }
    } else {
      removeChild()
      connectingRef.current = false
      logger.log('Configuration error: Please provide a WalletConnect Project ID in your wagmi config.')
      return {
        error: 'Configuration error: Please provide a WalletConnect Project ID in your wagmi config.',
      }
    }
  }, [])

  return { isOpen, open }
}
