import { embeddedWalletId } from '../../constants/openfort.js'
import type { WalletStatus } from '../types.js'

/**
 * Maps wallet status + activeWallet presence to the derived boolean/id props
 * shared by both Ethereum and Solana embedded wallet hooks.
 */
export function toConnectedStateProperties(status: WalletStatus, activeWallet: object | null) {
  if (status === 'creating' || status === 'fetching-wallets') {
    return {
      embeddedWalletId: undefined,
      isConnected: false,
      isConnecting: true,
      isDisconnected: false,
      isReconnecting: false,
    }
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return {
      embeddedWalletId,
      isConnected: false,
      isConnecting: true,
      isDisconnected: false,
      isReconnecting: status === 'reconnecting',
    }
  }

  if ((status === 'connected' || status === 'needs-recovery') && activeWallet) {
    return {
      embeddedWalletId,
      isConnected: status === 'connected',
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
    }
  }

  return {
    embeddedWalletId: undefined,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    isReconnecting: false,
  }
}
