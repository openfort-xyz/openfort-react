import {
  ChevronDownIcon,
  ChevronUpIcon,
  FingerPrintIcon,
  KeyIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import {
  RecoveryMethod,
  useSignOut,
  useUser,
} from '@openfort/react'
import {
  type ConnectedEmbeddedSolanaWallet,
  useSolanaEmbeddedWallet,
} from '@openfort/react/solana'
import { useState } from 'react'
import { CreateWallet, CreateWalletSheet } from '../createWallet'
import { WalletRecoverPasswordSheet } from '../passwordRecovery'

const VISIBLE_WALLET_COUNT = 4

const WalletRecoveryBadge = ({ wallet }: { wallet: ConnectedEmbeddedSolanaWallet }) => {
  let Icon = LockClosedIcon
  let text = 'Unknown'

  switch (wallet.recoveryMethod) {
    case RecoveryMethod.PASSWORD:
      Icon = KeyIcon
      text = 'Password'
      break
    case RecoveryMethod.AUTOMATIC:
      Icon = LockClosedIcon
      text = 'Automatic'
      break
    case RecoveryMethod.PASSKEY:
      Icon = FingerPrintIcon
      text = 'Passkey'
      break
  }

  return (
    <div className="flex items-center text-xs">
      <span>{text}</span>
      <Icon className="h-5 w-5 ml-2" />
    </div>
  )
}

const WalletItem = ({
  wallet,
  isActive,
  isConnecting,
  onClick,
}: {
  wallet: ConnectedEmbeddedSolanaWallet
  isActive: boolean
  isConnecting: boolean
  onClick: () => void
}) => (
  <button
    key={wallet.id + wallet.address}
    className="px-4 py-3 border data-[active=true]:border-zinc-300 border-zinc-700 rounded data-[active=false]:cursor-pointer data-[active=false]:hover:bg-zinc-700/20 hover:border-zinc-300 transition-colors flex-1 text-sm w-full"
    onClick={onClick}
    data-active={isActive}
    disabled={isActive || isConnecting}
    type="button"
  >
    {isConnecting && isActive ? (
      <p>Connecting...</p>
    ) : (
      <div className="flex justify-between items-center">
        <p className="font-medium mr-2 font-mono">
          {`${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`}
        </p>
        <WalletRecoveryBadge wallet={wallet} />
      </div>
    )}
  </button>
)

export const Wallets = () => {
  const {
    wallets,
    status,
    activeWallet,
    setActive,
  } = useSolanaEmbeddedWallet()
  const isLoadingWallets = status === 'fetching-wallets'
  const isConnecting = status === 'connecting'
  const { user, isAuthenticated } = useUser()
  const { signOut } = useSignOut()
  const [createWalletSheetOpen, setCreateWalletSheetOpen] = useState(false)
  const [walletToRecover, setWalletToRecover] =
    useState<ConnectedEmbeddedSolanaWallet | null>(null)
  const [showAllWallets, setShowAllWallets] = useState(false)

  const handleWalletClick = (wallet: ConnectedEmbeddedSolanaWallet) => {
    const isActive = activeWallet?.address.toLowerCase() === wallet.address.toLowerCase()
    if (isActive || isConnecting) return
    if (wallet.recoveryMethod === RecoveryMethod.PASSWORD) {
      setWalletToRecover(wallet)
    } else {
      setActive({ address: wallet.address })
    }
  }

  if (!activeWallet && isConnecting) return <div>recovering ...</div>
  if (isLoadingWallets || (!user && isAuthenticated)) {
    return <div>Loading wallets...</div>
  }
  if (wallets.length === 0) {
    return (
      <div className="flex gap-2 flex-col w-full">
        <h1>Create a wallet</h1>
        <p>You do not have any wallet yet.</p>
        <CreateWallet />
      </div>
    )
  }

  const visibleWallets = showAllWallets
    ? wallets
    : wallets.slice(0, VISIBLE_WALLET_COUNT)

  return (
    <div className="flex flex-col w-full">
      <h1>Wallets</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Select a wallet to connect to your account.
      </p>
      <div className="space-y-4 pb-4">
        <h2>Your Wallets</h2>
        <div className="flex flex-col space-y-2">
          {visibleWallets.map((wallet) => {
            const isActive =
              activeWallet?.address.toLowerCase() === wallet.address.toLowerCase()

            return (
              <WalletItem
                key={wallet.id}
                wallet={wallet}
                isActive={isActive}
                isConnecting={isConnecting}
                onClick={() => handleWalletClick(wallet)}
              />
            )
          })}

          {wallets.length > VISIBLE_WALLET_COUNT && (
            <button
              type="button"
              className="flex items-center justify-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors py-1"
              onClick={() => setShowAllWallets((prev) => !prev)}
            >
              {showAllWallets ? (
                <>
                  Show less <ChevronUpIcon className="h-4 w-4" />
                </>
              ) : (
                <>
                  Show {wallets.length - VISIBLE_WALLET_COUNT} more{' '}
                  <ChevronDownIcon className="h-4 w-4" />
                </>
              )}
            </button>
          )}

          <button
            className="p-3 border border-zinc-700 rounded cursor-pointer hover:bg-zinc-700/20 hover:border-zinc-300 transition-colors flex-1"
            onClick={() => setCreateWalletSheetOpen(true)}
            type="button"
          >
            + Create Wallet
          </button>
        </div>
      </div>

      <WalletRecoverPasswordSheet
        wallet={walletToRecover}
        open={!!walletToRecover}
        onClose={() => setWalletToRecover(null)}
      />
      <CreateWalletSheet
        open={createWalletSheetOpen}
        onClose={() => setCreateWalletSheetOpen(false)}
      />

      <button
        onClick={() => {
          signOut()
        }}
        className="mt-auto btn"
      >
        Sign Out
      </button>
    </div>
  )
}
