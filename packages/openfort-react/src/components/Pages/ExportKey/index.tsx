'use client'

import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyIcon } from '../../../assets/icons'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { CopyIconButton } from '../../Common/CopyToClipboard/CopyIconButton'
import { ModalBody, ModalContent, ModalHeading } from '../../Common/Modal/styles'
import { FloatingGraphic } from '../../FloatingGraphic'
import { PageContent } from '../../PageContent'
import { AddressField, AddressRow, Label } from '../Receive/styles'
import { HoldButton, HoldFill, HoldLabel, KeyReveal } from './styles'

// TODO: Localize

const HOLD_MS = 5000

const ExportKey: React.FC = () => {
  const wallet = useEthereumEmbeddedWallet()
  const { exportPrivateKey } = wallet
  // A smart account is a contract (no private key); the exportable key is its
  // owner/signer EOA — a different address that won't show the account's funds
  // when imported into another wallet.
  const accountAddress = wallet.activeWallet?.address
  const ownerAddress = wallet.activeWallet?.ownerAddress
  const isSmartAccount = Boolean(
    ownerAddress && accountAddress && ownerAddress.toLowerCase() !== accountAddress.toLowerCase()
  )

  const [exportedKey, setExportedKey] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [showExportedKey, setShowExportedKey] = useState(false)

  // Press-and-hold gate: the key only reveals after a deliberate 5s hold.
  const [progress, setProgress] = useState(0)
  const holdingRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)

  const stopHold = useCallback(() => {
    holdingRef.current = false
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setProgress((p) => (p >= 1 ? p : 0))
  }, [])

  const startHold = useCallback(() => {
    if (showExportedKey || holdingRef.current) return
    holdingRef.current = true
    startRef.current = performance.now()
    const tick = (now: number) => {
      if (!holdingRef.current) return
      const p = Math.min(1, (now - startRef.current) / HOLD_MS)
      setProgress(p)
      if (p >= 1) {
        holdingRef.current = false
        setShowExportedKey(true)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [showExportedKey])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    []
  )

  useEffect(() => {
    const asyncExportKey = async () => {
      try {
        const key = await exportPrivateKey()
        setExportedKey(key)
      } catch {
        setExportError('You cannot export the private key for this wallet.')
        setExportedKey(null)
      }
    }
    asyncExportKey()
  }, [exportPrivateKey])

  return (
    <PageContent>
      <ModalHeading>Export private key</ModalHeading>
      <FloatingGraphic
        height="110px"
        logoCenter={{
          logo: <KeyIcon />,
        }}
        logoTopLeft={{
          logo: <KeyIcon />,
        }}
        logoBottomRight={{
          logo: <KeyIcon />,
        }}
        logoTopRight={{
          logo: <KeyIcon />,
        }}
        logoBottomLeft={{
          logo: <KeyIcon />,
        }}
      />
      <ModalContent>
        <ModalBody>
          {isSmartAccount ? (
            <p style={{ marginBottom: 6 }}>
              This is your account's <strong>owner (signer) key</strong> — not the account itself. Your smart account
              {accountAddress ? ` (${accountAddress.slice(0, 6)}…${accountAddress.slice(-4)})` : ''} is a contract with
              no private key, so importing this key into another wallet shows the owner address,{' '}
              <strong>not your funds</strong>. To move funds, use Send to withdraw to another wallet.
            </p>
          ) : (
            <p style={{ marginBottom: 6 }}>
              With your private key, you can access your account outside this application.
            </p>
          )}
          <p>Keep it safe and never share it with anyone you don't trust.</p>
        </ModalBody>
        {!showExportedKey ? (
          <HoldButton
            type="button"
            onPointerDown={startHold}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            style={{ marginTop: 12 }}
          >
            <HoldFill style={{ width: `${progress * 100}%` }} />
            <HoldLabel>
              {progress > 0
                ? `Hold to reveal… ${Math.ceil((1 - progress) * (HOLD_MS / 1000))}s`
                : 'Hold 5s to reveal key'}
            </HoldLabel>
          </HoldButton>
        ) : exportError ? (
          <ModalBody style={{ marginTop: 12 }} $error>
            {exportError}
          </ModalBody>
        ) : exportedKey ? (
          <KeyReveal>
            <Label>Your private key</Label>
            <AddressRow>
              <AddressField style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {exportedKey}
              </AddressField>
              <CopyIconButton value={exportedKey} />
            </AddressRow>
          </KeyReveal>
        ) : (
          <>Loading...</>
        )}
      </ModalContent>
    </PageContent>
  )
}

export default ExportKey
