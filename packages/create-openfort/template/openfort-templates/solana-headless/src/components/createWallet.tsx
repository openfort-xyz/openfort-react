import {
  FingerPrintIcon,
  KeyIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import { RecoveryMethod } from '@openfort/react'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { useState } from 'react'
import { CreateWalletPasswordSheet } from './passwordRecovery'
import { Sheet } from './ui/Sheet'

type CreateWalletSheetProps = {
  open: boolean
  onClose: () => void
  onWalletCreated?: () => void
}

export const CreateWalletSheet = ({ open, onClose, onWalletCreated }: CreateWalletSheetProps) => {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Create Wallet"
      description="Please choose a recovery method for your new wallet."
    >
      <CreateWallet
        onWalletCreated={() => {
          onClose()
          onWalletCreated?.()
        }}
      />
    </Sheet>
  )
}

export const CreateWallet = ({ onWalletCreated }: { onWalletCreated?: () => void }) => {
  const { create, status } = useSolanaEmbeddedWallet()
  const [error, setError] = useState<string | null>(null)
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false)

  const isCreating = status === 'creating'

  if (isCreating) {
    return <div>Creating wallet...</div>
  }

  const handleCreate = async (recoveryMethod: RecoveryMethod, password?: string) => {
    try {
      await create({ recoveryMethod, ...(password && { password }) })
      onWalletCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet')
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 wallet-option-group mb-4">
        <p className="text-sm text-zinc-400">Select recovery method:</p>
        <button
          type="button"
          className="wallet-option cursor-pointer"
          onClick={() => handleCreate(RecoveryMethod.PASSKEY)}
        >
          <FingerPrintIcon />
          <div className="flex flex-col text-start">
            <h4>Passkey</h4>
            <p className="text-sm hover-description">
              Secure your wallet with biometric authentication.
            </p>
          </div>
        </button>
        <button
          type="button"
          className="wallet-option cursor-pointer"
          onClick={() => handleCreate(RecoveryMethod.AUTOMATIC)}
        >
          <LockClosedIcon />
          <div className="flex flex-col text-start">
            <h4>Automatic recovery</h4>
            <p className="text-sm hover-description">
              Uses encryption session to recover your wallet.
            </p>
          </div>
        </button>
        <button
          type="button"
          className="wallet-option cursor-pointer"
          onClick={() => setPasswordSheetOpen(true)}
        >
          <KeyIcon />
          <div className="flex flex-col text-start">
            <h4>Password</h4>
            <p className="text-sm hover-description">
              Create a strong password to secure your wallet.
            </p>
          </div>
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-2">Error: {error}</p>}

      <p className="mb-4 text-xs text-zinc-400">
        Disclaimer: This is a demo of Openfort recovery methods. In production,
        it's best to choose one method for a smoother user experience.
      </p>

      <CreateWalletPasswordSheet
        open={passwordSheetOpen}
        onClose={() => setPasswordSheetOpen(false)}
        create={create}
        status={status}
        onCreateWallet={onWalletCreated}
      />
    </>
  )
}
