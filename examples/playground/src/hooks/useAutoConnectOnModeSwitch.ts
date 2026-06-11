/**
 * Auto-connects to the embedded wallet of the target chain when playground mode switches.
 * If a wallet exists (AUTOMATIC or PASSKEY recovery), sets it active.
 * Skips PASSWORD-recovery wallets (user must go through the modal).
 *
 * Only runs once per mode switch, and only when accounts have finished loading.
 * Retries if accounts were empty on first load (waits for them to populate).
 */

import { ChainTypeEnum, RecoveryMethod, useOpenfort, useUser } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/lib/useAppStore'
import type { OpenfortPlaygroundMode } from '@/providers'

export function useAutoConnectOnModeSwitch(mode: OpenfortPlaygroundMode) {
  const { user } = useUser()
  const { embeddedAccounts, isLoadingAccounts } = useOpenfort()
  const connectOnLogin = useAppStore((s) => s.providerOptions.walletConfig?.connectOnLogin ?? true)
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()

  // Track which mode has been successfully handled so we don't run twice
  const handledModeRef = useRef<OpenfortPlaygroundMode | null>(null)

  // Stable refs to wallet actions — avoids wallet objects as effect deps
  const setActiveRef = useRef<typeof ethereumWallet.setActive>(ethereumWallet.setActive)
  const solanaSetActiveRef = useRef<typeof solanaWallet.setActive>(solanaWallet.setActive)
  useEffect(() => {
    setActiveRef.current = ethereumWallet.setActive
  }, [ethereumWallet.setActive])
  useEffect(() => {
    solanaSetActiveRef.current = solanaWallet.setActive
  }, [solanaWallet.setActive])

  // Stable refs to current wallet status — read inside effect without adding to deps
  const ethereumStatusRef = useRef(ethereumWallet.status)
  const solanaStatusRef = useRef(solanaWallet.status)
  useEffect(() => {
    ethereumStatusRef.current = ethereumWallet.status
  }, [ethereumWallet.status])
  useEffect(() => {
    solanaStatusRef.current = solanaWallet.status
  }, [solanaWallet.status])

  useEffect(() => {
    // Reset handled state when mode changes so we try again on the new mode
    handledModeRef.current = null
  }, [mode])

  useEffect(() => {
    if (!user) return
    if (isLoadingAccounts) return
    if (!connectOnLogin) return

    const targetChain = mode === 'svm' ? ChainTypeEnum.SVM : ChainTypeEnum.EVM
    const chainAccounts = (embeddedAccounts ?? []).filter((a) => a.chainType === targetChain)

    // No accounts yet — wait; effect will re-run when embeddedAccounts populates
    if (chainAccounts.length === 0) return

    // Already handled this mode successfully
    if (handledModeRef.current === mode) return

    const walletStatus = mode === 'svm' ? solanaStatusRef.current : ethereumStatusRef.current

    if (walletStatus === 'connected') {
      handledModeRef.current = mode
      return
    }
    if (walletStatus === 'connecting' || walletStatus === 'creating') return

    const setActive = mode === 'svm' ? solanaSetActiveRef.current : setActiveRef.current

    const automatic = chainAccounts.find((w) => w.recoveryMethod === RecoveryMethod.AUTOMATIC)
    const target = automatic ?? chainAccounts.find((w) => w.recoveryMethod === RecoveryMethod.PASSKEY)

    if (!target) return

    handledModeRef.current = mode
    setActive({ address: target.address as string }).catch(() => {
      // Allow retry on next render cycle
      handledModeRef.current = null
    })
    // wallet.create() intentionally omitted — autoCreateWalletAfterAuth:false in config.
  }, [mode, user, isLoadingAccounts, embeddedAccounts, connectOnLogin])
}
