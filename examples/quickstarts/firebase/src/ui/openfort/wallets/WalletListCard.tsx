import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
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
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { CreateWallet, CreateWalletSheet } from './WalletCreation'
import { WalletRecoverPasswordSheet } from './WalletPasswordSheets'

const ACCOUNT_TYPE_LABELS: Record<AccountTypeEnum, string> = {
  [AccountTypeEnum.EOA]: 'EOA',
  [AccountTypeEnum.SMART_ACCOUNT]: 'SM',
  [AccountTypeEnum.DELEGATED_ACCOUNT]: 'DE',
}

const VISIBLE_WALLET_COUNT = 4

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
    <div className="flex items-center text-xs">
      <span>{label}</span>
      <Icon className="h-5 w-5 ml-2" />
    </div>
  )
}

function WalletItem({
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
    <div className={nested ? 'ml-5 flex items-center gap-1' : undefined}>
      {nested && <span className="text-zinc-500 text-sm">↳</span>}
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
            <p className="font-medium mr-2">
              {`${wallet.address.substring(0, 6)}...${wallet.address.substring(wallet.address.length - 4)}`}
            </p>
            <div className="flex items-center gap-2">
              {wallet.accountType && (
                <span className="text-[10px] font-semibold leading-none border border-zinc-600 rounded px-1 py-0.5 opacity-70">
                  {ACCOUNT_TYPE_LABELS[wallet.accountType]}
                </span>
              )}
              <WalletRecoveryBadge wallet={wallet} />
            </div>
          </div>
        )}
      </button>
    </div>
  )
}

export function WalletListCard() {
  const {
    wallets,
    status,
    activeWallet,
    setActive,
    exportPrivateKey,
  } = useEthereumEmbeddedWallet()
  const isLoadingWallets = status === 'fetching-wallets'
  const isConnecting = status === 'connecting'
  const { user, isAuthenticated } = useUser()
  const { isConnected } = useAccount()
  const { signOut } = useSignOut()

  const [createWalletSheetOpen, setCreateWalletSheetOpen] = useState(false)
  const [walletToRecover, setWalletToRecover] =
    useState<ConnectedEmbeddedEthereumWallet | null>(null)
  const [showAllWallets, setShowAllWallets] = useState(false)
  const [exportedKey, setExportedKey] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Group wallets: EOAs at top level, Smart/Delegated accounts nested under their owner
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

  const handleExportKey = async () => {
    setIsExporting(true)
    setExportError(null)
    setExportedKey(null)
    try {
      const key = await exportPrivateKey()
      setExportedKey(key)
    } catch {
      setExportError('Cannot export private key for this wallet.')
    } finally {
      setIsExporting(false)
    }
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

  const visibleTopLevel = showAllWallets
    ? topLevel
    : topLevel.slice(0, VISIBLE_WALLET_COUNT)

  return (
    <div className="flex flex-col w-full">
      <h1>Wallets</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Select a wallet to connect to your account.
      </p>

      <div className="space-y-4 pb-4">
        <h2>Your Wallets</h2>
        <div className="flex flex-col space-y-2">
          {visibleTopLevel.map((wallet) => {
            const isActive =
              activeWallet?.address.toLowerCase() === wallet.address.toLowerCase()
            const children = childrenByOwner.get(wallet.address.toLowerCase())

            return (
              <div key={wallet.id} className="space-y-1">
                <WalletItem
                  wallet={wallet}
                  isActive={isActive}
                  isConnecting={isConnecting}
                  onClick={() => handleWalletClick(wallet)}
                />
                {children?.map((child) => {
                  const isChildActive =
                    activeWallet?.address.toLowerCase() === child.address.toLowerCase()
                  return (
                    <WalletItem
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

          {topLevel.length > VISIBLE_WALLET_COUNT && (
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
                  Show {topLevel.length - VISIBLE_WALLET_COUNT} more{' '}
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

        {activeWallet && (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="w-full p-3 border border-zinc-700 rounded cursor-pointer hover:bg-zinc-700/20 hover:border-zinc-300 transition-colors text-sm flex items-center justify-center gap-2"
              onClick={handleExportKey}
              disabled={isExporting}
            >
              <KeyIcon className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export Private Key'}
            </button>
            {exportError && (
              <p className="text-red-400 text-xs">{exportError}</p>
            )}
            {exportedKey && (
              <div className="flex items-center gap-2 p-3 border border-zinc-700 rounded bg-zinc-800 text-xs break-all font-mono">
                <span className="flex-1">{exportedKey}</span>
                <button
                  type="button"
                  className="shrink-0 p-1 rounded hover:bg-zinc-700 transition-colors cursor-pointer"
                  onClick={() => {
                    navigator.clipboard.writeText(exportedKey)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? (
                    <CheckIcon className="h-4 w-4 text-green-400" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4 text-zinc-400" />
                  )}
                </button>
              </div>
            )}
          </div>
        )}
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
          onClick={() => {
            signOut()
          }}
          className="mt-auto btn"
        >
          Sign Out
        </button>
      )}
    </div>
  )
}
