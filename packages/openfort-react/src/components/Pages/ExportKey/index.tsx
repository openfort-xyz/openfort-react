'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { KeyIcon } from '../../../assets/icons'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import Button from '../../Common/Button'
import { CopyText } from '../../Common/CopyToClipboard/CopyText'
import { ModalBody, ModalContent, ModalHeading } from '../../Common/Modal/styles'
import { FloatingGraphic } from '../../FloatingGraphic'
import { PageContent } from '../../PageContent'

// TODO: Localize

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
          <Button onClick={() => setShowExportedKey(true)} style={{ marginTop: 12 }}>
            Export key
          </Button>
        ) : exportError ? (
          <ModalBody style={{ marginTop: 12 }} $error>
            {exportError}
          </ModalBody>
        ) : exportedKey ? (
          <div style={{ marginTop: 12 }}>
            <CopyText value={exportedKey}>
              {exportedKey.slice(0, 10)}...{exportedKey.slice(-10)}
            </CopyText>
          </div>
        ) : (
          <>Loading...</>
        )}
      </ModalContent>
    </PageContent>
  )
}

export default ExportKey
