import React from 'react'
import type { WalletFlowStatus } from '../hooks/openfort/useWallets'
import { useOpenfortStore } from '../store/useOpenfortStore'
import { Context } from './context'

export const useOpenfortCore = () => {
  const context = React.useContext(Context)
  if (!context) throw Error('useOpenfortContext Hook must be inside CoreOpenfortProvider.')
  return context
}

export const useWalletStatus = (): [WalletFlowStatus, (status: WalletFlowStatus) => void] => {
  const walletStatus = useOpenfortStore((s) => s.walletStatus)
  const setWalletStatus = useOpenfortStore((s) => s.setWalletStatus)
  return [walletStatus, setWalletStatus]
}
