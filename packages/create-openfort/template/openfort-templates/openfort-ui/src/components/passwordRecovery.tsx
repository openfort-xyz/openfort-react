import { CheckCircleIcon } from '@heroicons/react/24/outline'
import {
  AccountTypeEnum,
  RecoveryMethod,
  type ConnectedEmbeddedEthereumWallet,
} from '@openfort/react'
import type { EmbeddedAccount } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useState } from 'react'
import { Sheet } from './ui/Sheet'

type CreateWalletPasswordSheetProps = {
  open: boolean
  onClose: () => void
  onCreateWallet?: () => void
  create: (options: {
    recoveryMethod: RecoveryMethod
    accountType?: AccountTypeEnum
    password?: string
  }) => Promise<EmbeddedAccount>
  status: string
  accountType: AccountTypeEnum
}

export const CreateWalletPasswordSheet = ({
  open,
  onClose,
  onCreateWallet,
  create,
  status,
  accountType,
}: CreateWalletPasswordSheetProps) => {
  const [error, setError] = useState<string | null>(null)
  const isCreating = status === 'creating'

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose()
        setError(null)
      }}
      title="Enter Password"
      description="Please enter the password of your wallet."
    >
      <form
        className="flex-1 w-full flex flex-col justify-center max-w-md mx-auto"
        onSubmit={async (e) => {
          e.preventDefault()
          const formData = new FormData(e.target as HTMLFormElement)
          const password = formData.get('password') as string

          try {
            await create({
              recoveryMethod: RecoveryMethod.PASSWORD,
              accountType,
              password,
            })
            onCreateWallet?.()
            onClose()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create wallet')
          }
        }}
      >
        <div className="flex flex-col gap-2 mr-4 mb-4">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-primary my-4 shrink-0" />
            <span>This password will be used to secure your account.</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-primary my-4 shrink-0" />
            <span>
              If you lose this password, you will not be able to access your
              wallet.
            </span>
          </div>
        </div>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Enter your wallet's password"
          className="w-full mt-2 p-2 border border-gray-300 rounded"
        />
        {error && (
          <span className="text-red-500 text-sm mt-2">{error}</span>
        )}
        <button
          className="mt-4 w-full bg-zinc-700 text-white p-2 rounded cursor-pointer"
          type="submit"
          disabled={isCreating}
        >
          {isCreating ? 'Creating wallet...' : 'Create Wallet'}
        </button>
      </form>
    </Sheet>
  )
}

type WalletRecoverPasswordProps = {
  open: boolean
  onClose: () => void
  wallet: ConnectedEmbeddedEthereumWallet | null
}

export const WalletRecoverPasswordSheet = ({
  open,
  onClose,
  wallet,
}: WalletRecoverPasswordProps) => {
  const { setActive, status } = useEthereumEmbeddedWallet()
  const [error, setError] = useState<string | null>(null)
  const isConnecting = status === 'connecting'

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose()
        setError(null)
      }}
      title="Enter Password"
      description="Please enter the password of your wallet."
    >
      <form
        className="w-full flex-1 flex flex-col justify-center"
        onSubmit={async (e) => {
          e.preventDefault()
          const formData = new FormData(e.target as HTMLFormElement)
          const password = formData.get('password') as string
          if (!wallet) throw new Error('No wallet to recover')

          try {
            await setActive({
              address: wallet.address,
              recoveryMethod: RecoveryMethod.PASSWORD,
              password,
            })
            onClose()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to recover wallet')
          }
        }}
      >
        {wallet && (
          <p>
            Recover wallet {wallet.address.slice(0, 6)}...
            {wallet.address.slice(-4)} with password
          </p>
        )}
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your wallet's password"
          className="w-full mt-2 p-2 border border-gray-300 rounded"
        />
        {error && (
          <span className="text-red-500 text-sm mt-2">{error}</span>
        )}
        <button
          className="mt-4 w-full bg-zinc-700 text-white p-2 rounded cursor-pointer"
          type="submit"
          disabled={isConnecting}
        >
          {isConnecting ? 'Recovering...' : 'Recover Wallet'}
        </button>
      </form>
    </Sheet>
  )
}
