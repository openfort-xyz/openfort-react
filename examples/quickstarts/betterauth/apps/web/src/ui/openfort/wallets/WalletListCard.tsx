import {
  FingerPrintIcon,
  KeyIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import {
  AccountTypeEnum,
  RecoveryMethod,
  type ConnectedEmbeddedEthereumWallet,
  useSignOut,
  useUser,
} from '@openfort/react'
import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { signOut as betterAuthSignOut } from '../../../integrations/betterauth'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { WalletRecoverPasswordSheet } from './WalletPasswordSheets'
import { CreateWallet, CreateWalletSheet } from './WalletCreation'

const ACCOUNT_TYPE_BADGE: Record<AccountTypeEnum, string> = {
  [AccountTypeEnum.EOA]: 'EOA',
  [AccountTypeEnum.SMART_ACCOUNT]: 'SM',
  [AccountTypeEnum.DELEGATED_ACCOUNT]: 'DE',
}

function WalletRecoveryBadge({ wallet }: { wallet: ConnectedEmbeddedEthereumWallet }) {
  let Icon = LockClosedIcon
  let label = 'Unknown'

  switch (wallet.recoveryMethod) {
    case RecoveryMethod.PASSWORD:
      Icon = KeyIcon
      label = 'Password'
      break
    case RecoveryMethod.AUTOMATIC:
      Icon = LockClosedIcon
      label = 'Automatic'
      break
    case RecoveryMethod.PASSKEY:
      Icon = FingerPrintIcon
      label = 'Passkey'
      break
  }

  return (
    <div className="flex items-center text-xs gap-1">
      <span>{label}</span>
      <Icon className="h-4 w-4" />
    </div>
  )
}

function WalletRow({
  wallet,
  isActive,
  isConnecting,
  nested,
  onClick,
}: {
  wallet: ConnectedEmbeddedEthereumWallet
  isActive: boolean
  isConnecting: boolean
  nested?: boolean
  onClick: () => void
}) {
  return (
    <button
      key={wallet.id + wallet.address}
      type="button"
      className={`px-4 py-3 border data-[active=true]:border-zinc-300 border-zinc-700 rounded data-[active=false]:cursor-pointer data-[active=false]:hover:bg-zinc-700/20 hover:border-zinc-300 transition-colors flex-1 text-sm ${nested ? 'ml-5' : ''}`}
      onClick={onClick}
      data-active={isActive}
      disabled={isActive || isConnecting}
    >
      {isConnecting && isActive ? (
        <p>Connecting...</p>
      ) : (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {nested && <span className="text-zinc-500 text-xs">↳</span>}
            <p className="font-medium">
              {`${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`}
            </p>
            {wallet.accountType && (
              <span className="text-[10px] font-semibold border border-zinc-600 rounded px-1 py-0.5 text-zinc-400">
                {ACCOUNT_TYPE_BADGE[wallet.accountType]}
              </span>
            )}
          </div>
          <WalletRecoveryBadge wallet={wallet} />
        </div>
      )}
    </button>
  )
}

export function WalletListCard() {
  const {
    wallets,
    status,
    activeWallet,
    setActive,
  } = useEthereumEmbeddedWallet()
  const isLoadingWallets = status === 'fetching-wallets'
  const isConnecting = status === 'connecting'
  const { user, isAuthenticated } = useUser()
  const { isConnected } = useAccount()
  const { signOut } = useSignOut()

  const [createWalletSheetOpen, setCreateWalletSheetOpen] = useState(false)
  const [walletToRecover, setWalletToRecover] =
    useState<ConnectedEmbeddedEthereumWallet | null>(null)

  // Build parent/child hierarchy: Smart Accounts are children of their EOA owner
  const { topLevel, childrenByOwner } = useMemo(() => {
    const ownerAddresses = new Set(wallets.map((w) => w.address.toLowerCase()))
    const childrenByOwner = new Map<string, ConnectedEmbeddedEthereumWallet[]>()
    const topLevel: ConnectedEmbeddedEthereumWallet[] = []

    for (const wallet of wallets) {
      const owner = wallet.ownerAddress?.toLowerCase()
      if (owner && ownerAddresses.has(owner) && owner !== wallet.address.toLowerCase()) {
        const existing = childrenByOwner.get(owner) ?? []
        existing.push(wallet)
        childrenByOwner.set(owner, existing)
      } else {
        topLevel.push(wallet)
      }
    }

    return { topLevel, childrenByOwner }
  }, [wallets])

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

  const handleWalletClick = (wallet: ConnectedEmbeddedEthereumWallet) => {
    const isActive =
      activeWallet?.address.toLowerCase() === wallet.address.toLowerCase()
    if (isActive || isConnecting) return

    if (wallet.recoveryMethod === RecoveryMethod.PASSWORD) {
      setWalletToRecover(wallet)
      return
    }

    setActive({ address: wallet.address })
  }

  return (
    <div className="flex flex-col w-full">
      <h1>Wallets</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Select a wallet to connect to your account.
      </p>

      <div className="space-y-4 pb-4">
        <h2>Your Wallets</h2>
        <div className="flex flex-col space-y-2">
          {topLevel.map((wallet) => {
            const children = childrenByOwner.get(wallet.address.toLowerCase())
            const isActive =
              activeWallet?.address.toLowerCase() === wallet.address.toLowerCase()
            return (
              <div key={wallet.id} className="flex flex-col space-y-1">
                <WalletRow
                  wallet={wallet}
                  isActive={isActive}
                  isConnecting={isConnecting}
                  onClick={() => handleWalletClick(wallet)}
                />
                {children?.map((child) => {
                  const isChildActive =
                    activeWallet?.address.toLowerCase() === child.address.toLowerCase()
                  return (
                    <WalletRow
                      key={child.id}
                      wallet={child}
                      isActive={isChildActive}
                      isConnecting={isConnecting}
                      nested
                      onClick={() => handleWalletClick(child)}
                    />
                  )
                })}
              </div>
            )
          })}

          <button
            type="button"
            className="p-3 border border-zinc-700 rounded cursor-pointer hover:bg-zinc-700/20 hover:border-zinc-300 transition-colors flex-1"
            onClick={() => setCreateWalletSheetOpen(true)}
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

      {!isConnected && (
        <button
          type="button"
          onClick={async () => {
            await betterAuthSignOut().catch((error) => {
              console.error('Better Auth - Failed to sign out', error)
            })
            await signOut()
          }}
          className="mt-auto btn"
        >
          Sign Out
        </button>
      )}
    </div>
  )
}
