'use client'

import { useEffect, useState } from 'react'
import { useEthereumBridge } from '../ethereum/OpenfortEthereumBridgeContext'
import { logger } from '../utils/logger'

export const useLastConnector = () => {
  const bridge = useEthereumBridge()
  const storage = bridge?.config?.storage
  const [lastConnectorId, setLastConnectorId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const id = storage ? await storage.getItem('recentConnectorId') : null
        if (!cancelled) setLastConnectorId(id ?? '')
      } catch (err) {
        if (!cancelled && process.env.NODE_ENV === 'development') {
          logger.warn('[Openfort] Failed to load recent connector:', err)
        }
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [storage])

  const update = (id: string) => {
    storage?.setItem('recentConnectorId', id)
  }

  return {
    lastConnectorId,
    updateLastConnectorId: update,
  }
}
