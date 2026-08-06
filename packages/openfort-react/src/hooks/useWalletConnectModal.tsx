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

    // The Openfort modal sits at z-index 2147483646, so the WalletConnect modal
    // must take the one slot above it. A constructed stylesheet (CSSOM) is used
    // instead of an injected <style> tag because CSP style-src blocks inline
    // style elements in hardened apps — which silently left the WalletConnect
    // modal rendering UNDER the Openfort modal.
    const WC_CSS = `w3m-modal, wcm-modal { --wcm-z-index: 2147483647; --w3m-z-index: 2147483647; z-index: 2147483647; }`
    let removeChild = () => {}
    try {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(WC_CSS)
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
      removeChild = () => {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet)
      }
    } catch {
      // Constructable stylesheets unsupported: fall back to a style tag (may be
      // dropped by a strict CSP, in which case the modals keep their old order).
      const w3mcss = document.createElement('style')
      w3mcss.textContent = WC_CSS
      document.head.appendChild(w3mcss)
      removeChild = () => {
        if (document.head.contains(w3mcss)) {
          document.head.removeChild(w3mcss)
        }
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
