'use client'

import { useEffect, useRef } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { embeddedWalletId } from '../constants/openfort.js'
import { useEthereumEmbeddedWallet } from '../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { logger } from '../utils/logger.js'
import { setEmbeddedWalletProvider } from './embeddedConnector.js'

/** Null component — rendered inside CoreOpenfortProvider + WagmiProvider to sync embedded wallet into wagmi. */
export function EmbeddedWalletWagmiSync(): null {
  useEmbeddedWalletWagmiSync()
  return null
}

function useEmbeddedWalletWagmiSync() {
  const wallet = useEthereumEmbeddedWallet()
  const { connector: activeConnector, status: wagmiStatus } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()

  const status = wallet.status
  const provider = status === 'connected' ? wallet.provider : null

  // Track whether an external wallet was explicitly connected — don't override it
  const externalConnectorActiveRef = useRef(false)
  const connectFailedRef = useRef(false)

  useEffect(() => {
    if (activeConnector && activeConnector.id !== embeddedWalletId) {
      externalConnectorActiveRef.current = true
    } else if (!activeConnector || activeConnector.id === embeddedWalletId) {
      externalConnectorActiveRef.current = false
    }
  }, [activeConnector])

  // Reset failure flag when provider changes (new session = fresh attempt)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `provider` is the trigger — a new provider means a new session, which is allowed one more connect attempt
  useEffect(() => {
    connectFailedRef.current = false
  }, [provider])

  // Keep the module-level provider slot in sync — clear on disconnect
  useEffect(() => {
    if (status === 'connected' && provider) {
      setEmbeddedWalletProvider(provider)
      return () => {
        setEmbeddedWalletProvider(null)
      }
    }
    return undefined
  }, [status, provider])

  // Connect wagmi once the embedded wallet is ready AND wagmi has settled (not mid-reconnect)
  // BUT do NOT override an explicitly connected external wallet
  useEffect(() => {
    if (status !== 'connected' || !provider) return
    if (wagmiStatus === 'connecting' || wagmiStatus === 'reconnecting') return
    if (activeConnector?.id === embeddedWalletId) return

    // Already failed for this provider — don't retry
    if (connectFailedRef.current) return

    // An external wallet is actively connected — don't override it
    if (externalConnectorActiveRef.current) {
      logger.log('[EmbeddedWalletWagmiSync] Skipping auto-connect — external wallet is active', {
        activeConnector: activeConnector?.id,
      })
      return
    }

    const embeddedConnector = connectors.find((c) => c.id === embeddedWalletId)
    if (!embeddedConnector) return

    logger.log('[EmbeddedWalletWagmiSync] Auto-connecting embedded wallet to wagmi')
    connectAsync({ connector: embeddedConnector }).catch((error) => {
      connectFailedRef.current = true
      logger.error('[EmbeddedWalletWagmiSync] Failed to connect embedded wallet to wagmi', error)
    })
  }, [status, provider, wagmiStatus, activeConnector, connectors, connectAsync])

  // Disconnect embedded connector from wagmi when the embedded wallet logs out
  useEffect(() => {
    if (status !== 'disconnected') return
    if (activeConnector?.id !== embeddedWalletId) return

    const embeddedConnector = connectors.find((c) => c.id === embeddedWalletId)
    if (embeddedConnector) {
      disconnectAsync({ connector: embeddedConnector }).catch(() => {})
    }
  }, [status, activeConnector, connectors, disconnectAsync])
}
