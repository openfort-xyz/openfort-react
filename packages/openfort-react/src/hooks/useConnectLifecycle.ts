'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { ConnectionStrategy } from '../core/ConnectionStrategy'
import type { ConnectCallbackProps } from '../openfort/connectCallbackTypes'
import { useOpenfortStore } from '../openfort/useOpenfortStore'

/**
 * Standalone hook: subscribes to connection lifecycle and fires onConnect/onDisconnect
 * when strategy.isConnected(state) changes. Must be used inside CoreOpenfortProvider.
 */
export function useConnectLifecycle(
  strategy: ConnectionStrategy | null,
  onConnect: ConnectCallbackProps['onConnect'],
  onDisconnect: ConnectCallbackProps['onDisconnect']
): void {
  const user = useOpenfortStore((s) => s.user)
  const embeddedAccounts = useOpenfortStore((s) => s.embeddedAccounts)
  const activeEmbeddedAddress = useOpenfortStore((s) => s.activeEmbeddedAddress)
  const embeddedState = useOpenfortStore((s) => s.embeddedState)
  const chainType = useOpenfortStore((s) => s.chainType)
  const prevConnected = useRef(false)

  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)
  useLayoutEffect(() => {
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
  }, [onConnect, onDisconnect])

  useEffect(() => {
    if (!strategy) return

    const state = { user, embeddedAccounts, chainType, activeEmbeddedAddress, embeddedState }
    const connected = strategy.isConnected(state)

    if (connected && !prevConnected.current) {
      prevConnected.current = true
      const address = strategy.getAddress(state)
      onConnectRef.current?.({ address: address ?? undefined, connectorId: undefined, user: state.user ?? undefined })
    } else if (!connected && prevConnected.current) {
      prevConnected.current = false
      onDisconnectRef.current?.()
    } else {
      prevConnected.current = connected
    }
  }, [strategy, user, embeddedAccounts, activeEmbeddedAddress, embeddedState, chainType])
}
