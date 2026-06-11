import {
  FingerPrintIcon,
  KeyIcon,
  LockClosedIcon,
  WalletIcon,
} from '@heroicons/react/24/outline'
import { AccountTypeEnum, RecoveryMethod } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useState } from 'react'

import { Sheet } from '../../../components/ui/Sheet'
import { CreateWalletPasswordSheet } from './WalletPasswordSheets'

type CreateStep = 'choose-account-type' | 'choose-recovery-method'

type CreateWalletSheetProps = {
  open: boolean
  onClose: () => void
  onWalletCreated?: () => void
}

export function CreateWalletSheet({
  open,
  onClose,
  onWalletCreated,
}: CreateWalletSheetProps) {
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

export function CreateWallet({
  onWalletCreated,
}: {
  onWalletCreated?: () => void
}) {
  const { create, status } = useEthereumEmbeddedWallet()
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<CreateStep>('choose-account-type')
  const [accountType, setAccountType] = useState<AccountTypeEnum>(AccountTypeEnum.SMART_ACCOUNT)
  const [passwordSheetOpen, setPasswordSheetOpen] = useState(false)

  const isCreating = status === 'creating'

  if (isCreating) {
    return <div>Creating wallet...</div>
  }

  const handleCreate = async (recoveryMethod: RecoveryMethod, password?: string) => {
    try {
      await create({ recoveryMethod, accountType, ...(password && { password }) })
      onWalletCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet')
    }
  }

  return (
    <>
      {step === 'choose-account-type' && (
        <div className="flex flex-col gap-4 wallet-option-group mb-4">
          <p className="text-sm text-zinc-400">Select account type:</p>
          {Object.values(AccountTypeEnum).map((type) => (
            <button
              key={type}
              type="button"
              className="wallet-option cursor-pointer"
              onClick={() => {
                setAccountType(type)
                setStep('choose-recovery-method')
              }}
            >
              <WalletIcon className="h-6 w-6 shrink-0" />
              <div className="flex flex-col text-start">
                <h4>{type}</h4>
                <p className="text-sm hover-description">
                  {type === AccountTypeEnum.EOA && 'A standard externally owned account.'}
                  {type === AccountTypeEnum.SMART_ACCOUNT &&
                    'A smart contract wallet (also creates an EOA owner).'}
                  {type === AccountTypeEnum.DELEGATED_ACCOUNT && 'A delegated smart account.'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {step === 'choose-recovery-method' && (
        <>
          <button
            type="button"
            className="text-xs text-zinc-400 mb-4 hover:text-zinc-200 flex items-center gap-1"
            onClick={() => setStep('choose-account-type')}
          >
            ← Back ·{' '}
            <span className="text-zinc-300">{accountType}</span>
          </button>
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
        </>
      )}

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
        accountType={accountType}
        onCreateWallet={onWalletCreated}
      />
    </>
  )
}
