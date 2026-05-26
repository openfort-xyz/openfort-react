/**
 * Shared embedded wallets list for evm (wagmi) and svm.
 * Renders parent/child hierarchy (EOA → Smart Account) with CornerDownRightIcon.
 */

import {
  AccountTypeEnum,
  type ConnectedEmbeddedEthereumWallet,
  type EthereumWalletState,
  RecoveryMethod,
  useOpenfort,
} from '@openfort/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import {
  ChevronLeftIcon,
  CornerDownRightIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2,
  RefreshCwIcon,
  WalletIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MP } from '@/components/motion/motion'
import { WalletRecoveryIcon } from '@/components/Showcase/app/WalletRecoveryIcon'
import { TruncatedText } from '@/components/TruncatedText'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

const ACCOUNT_TYPE_BADGE: Record<AccountTypeEnum, string> = {
  [AccountTypeEnum.EOA]: 'EOA',
  [AccountTypeEnum.SMART_ACCOUNT]: 'SM',
  [AccountTypeEnum.DELEGATED_ACCOUNT]: 'DE',
}

const ACCOUNT_TYPE_LABELS: Record<AccountTypeEnum, string> = {
  [AccountTypeEnum.EOA]: 'EOA',
  [AccountTypeEnum.SMART_ACCOUNT]: 'Smart Account',
  [AccountTypeEnum.DELEGATED_ACCOUNT]: 'Delegated Account',
}

const AccountTypeBadge = ({ accountType }: { accountType: AccountTypeEnum | undefined }) => {
  if (!accountType) return null
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <span className="text-[10px] font-semibold leading-none border rounded px-1 py-0.5 opacity-70">
          {ACCOUNT_TYPE_BADGE[accountType]}
        </span>
      </TooltipTrigger>
      <TooltipContent>{ACCOUNT_TYPE_LABELS[accountType]}</TooltipContent>
    </Tooltip>
  )
}

type CreateStep = 'idle' | 'choose-account-type' | 'choose-recovery-method'

const CreateWalletButton = ({ ethereum }: { ethereum: EthereumWalletState }) => {
  const { create, status } = ethereum
  const [error, setError] = useState<string | null>(null)
  const isCreating = status === 'creating'
  const [step, setStep] = useState<CreateStep>('idle')
  const [selectedAccountType, setSelectedAccountType] = useState<AccountTypeEnum | null>(null)
  const [creatingMethod, setCreatingMethod] = useState<RecoveryMethod | null>(null)

  useEffect(() => {
    const handleClickOutsideCreateWallet = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.create-wallet-button')) {
        setStep('idle')
        setSelectedAccountType(null)
      }
    }
    document.addEventListener('click', handleClickOutsideCreateWallet)
    return () => document.removeEventListener('click', handleClickOutsideCreateWallet)
  }, [])

  const handleCreateWallet = async (recoveryMethod: RecoveryMethod) => {
    if (!selectedAccountType) return
    const accountType = selectedAccountType
    setCreatingMethod(recoveryMethod)
    setStep('idle')
    setSelectedAccountType(null)
    try {
      const options = {
        accountType,
        ...(recoveryMethod === RecoveryMethod.PASSWORD && {
          recoveryMethod: RecoveryMethod.PASSWORD,
          password: 'example-password',
        }),
        ...(recoveryMethod === RecoveryMethod.PASSKEY && { recoveryMethod: RecoveryMethod.PASSKEY }),
      }
      await create(options)
      setCreatingMethod(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet')
      setCreatingMethod(null)
    }
  }

  return (
    <>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <div className="flex w-full flex-col gap-2">
            {step === 'idle' && (
              <Button
                type="button"
                className="w-full create-wallet-button"
                onClick={() => setStep('choose-account-type')}
                disabled={isCreating}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="mr-2">+</span>}
                {isCreating ? `Creating${creatingMethod ? ` (${creatingMethod})` : ''}…` : 'Create new wallet'}
              </Button>
            )}
            {step === 'choose-account-type' && (
              <div className="flex flex-col gap-1 create-wallet-button">
                <span className="text-xs opacity-70 px-1">Account type:</span>
                <div className="flex w-full gap-2">
                  {Object.values(AccountTypeEnum).map((accountType) => (
                    <Button
                      key={accountType}
                      type="button"
                      className="flex-1 create-wallet-button"
                      onClick={() => {
                        setSelectedAccountType(accountType)
                        setStep('choose-recovery-method')
                      }}
                      disabled={isCreating}
                    >
                      <WalletIcon className="h-4 w-4" />
                      {ACCOUNT_TYPE_LABELS[accountType]}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {step === 'choose-recovery-method' && selectedAccountType && (
              <div className="flex flex-col gap-1 create-wallet-button">
                <div className="flex items-center gap-1 px-1">
                  <button
                    type="button"
                    className="create-wallet-button opacity-70 hover:opacity-100"
                    onClick={() => setStep('choose-account-type')}
                  >
                    <ChevronLeftIcon className="h-3 w-3" />
                  </button>
                  <span className="text-xs opacity-70">
                    {ACCOUNT_TYPE_LABELS[selectedAccountType]} — Recovery method:
                  </span>
                </div>
                <div className="flex w-full gap-2">
                  <Button
                    type="button"
                    className="flex-1 create-wallet-button"
                    onClick={() => handleCreateWallet(RecoveryMethod.AUTOMATIC)}
                    disabled={isCreating}
                  >
                    <WalletRecoveryIcon recovery={RecoveryMethod.AUTOMATIC} />
                    Automatic
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 create-wallet-button"
                    onClick={() => handleCreateWallet(RecoveryMethod.PASSWORD)}
                    disabled={isCreating}
                  >
                    <WalletRecoveryIcon recovery={RecoveryMethod.PASSWORD} />
                    Password
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 create-wallet-button"
                    onClick={() => handleCreateWallet(RecoveryMethod.PASSKEY)}
                    disabled={isCreating}
                  >
                    <WalletRecoveryIcon recovery={RecoveryMethod.PASSKEY} />
                    Passkey
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <h3 className="text-base mb-1">useEthereumEmbeddedWallet</h3>
          Create a new wallet using the
          <Link to="/wallet/useEthereumEmbeddedWallet" search={{ focus: 'create' }} className="px-1 group">
            create
          </Link>
          function.
        </TooltipContent>
      </Tooltip>
      <AnimatePresence mode="wait">
        {isCreating && (
          <MP
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 0.8, scale: 0.95 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            Creating wallet {creatingMethod && `with ${creatingMethod} recovery`}...
            {creatingMethod === RecoveryMethod.PASSWORD && (
              <span className="text-sm block mt-2 opacity-70">(using password: "example-password")</span>
            )}
          </MP>
        )}
      </AnimatePresence>
      {error && <span className="text-red-500 text-sm mt-2 block">There was an error: {error}</span>}
    </>
  )
}

const WalletButton = ({
  wallet,
  setActive,
  nested,
}: {
  wallet: ConnectedEmbeddedEthereumWallet
  setActive: (opts: { address: `0x${string}`; password?: string; recoveryMethod?: RecoveryMethod }) => Promise<void>
  nested?: boolean
}) => {
  const [password, setPassword] = useState('example-password')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const handleClickOutsidePassword = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.password-input')) setShowPasswordInput(false)
    }
    document.addEventListener('click', handleClickOutsidePassword)
    return () => document.removeEventListener('click', handleClickOutsidePassword)
  }, [])

  const handleSetActive = () => {
    if (wallet.recoveryMethod === RecoveryMethod.PASSWORD) {
      setActive({ address: wallet.address, recoveryMethod: RecoveryMethod.PASSWORD, password })
    } else if (wallet.recoveryMethod === RecoveryMethod.PASSKEY) {
      setActive({ address: wallet.address, recoveryMethod: RecoveryMethod.PASSKEY })
    } else {
      setActive({ address: wallet.address })
    }
  }

  const handleClickWallet = () => {
    if (wallet.recoveryMethod === RecoveryMethod.PASSWORD) {
      setShowPasswordInput(true)
    } else {
      handleSetActive()
    }
  }

  if (showPasswordInput) {
    return (
      <form className={cn('flex w-full gap-2 password-input', nested && 'ml-5')}>
        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter password"
          className="password-input"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="password-input"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOffIcon className="h-4 w-4 password-input" />
          ) : (
            <EyeIcon className="h-4 w-4 password-input" />
          )}
        </Button>
        <Button
          type="submit"
          size="sm"
          className="password-input"
          onClick={() => {
            handleSetActive()
            setShowPasswordInput(false)
          }}
        >
          Set Active
        </Button>
      </form>
    )
  }

  return (
    <div className={cn('flex items-center gap-1', nested && 'ml-5')}>
      {nested && <CornerDownRightIcon className="h-3 w-3 shrink-0 opacity-40" />}
      <Button
        type="button"
        variant="outline"
        onClick={() => !wallet.isActive && handleClickWallet()}
        disabled={!wallet.isAvailable}
        className={cn('w-full justify-between password-input', {
          'border-primary bg-primary/10 text-primary hover:bg-primary/15': wallet.isActive,
          'animate-pulse': wallet.isConnecting,
        })}
      >
        <TruncatedText text={wallet.id} startChars={8} endChars={4} className="text-left" />
        {wallet.isConnecting && (
          <MP initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 0.8, scale: 0.95 }}>
            Connecting...
          </MP>
        )}
        <div className="flex items-center gap-2">
          <AccountTypeBadge accountType={wallet.accountType} />
          {wallet.address && (
            <TruncatedText
              text={wallet.address}
              startChars={6}
              endChars={4}
              displayText={`${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`}
              className="text-xs"
            />
          )}
          <WalletRecoveryIcon recovery={wallet.recoveryMethod} />
        </div>
      </Button>
    </div>
  )
}

const WalletTooltipItem = ({
  wallet,
  index,
  setActive,
  nested,
}: {
  wallet: ConnectedEmbeddedEthereumWallet
  index: number
  activeWallet: ConnectedEmbeddedEthereumWallet | null
  connectingAddress: string | undefined
  setActive: (opts: { address: `0x${string}`; password?: string; recoveryMethod?: RecoveryMethod }) => Promise<void>
  nested?: boolean
}) => (
  <Tooltip delayDuration={500}>
    <TooltipTrigger asChild>
      <div>
        <WalletButton wallet={wallet} setActive={setActive} nested={nested} />
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <div className="flex flex-col gap-1">
        <h3 className="text-base mb-1">useEthereumEmbeddedWallet</h3>
        <pre className="flex text-xs flex-col gap-1">
          wallets[{index}] ={' '}
          {JSON.stringify(
            {
              id: wallet.id,
              address: wallet.address,
              accountType: wallet.accountType,
              recoveryMethod: wallet.recoveryMethod,
              ownerAddress: wallet.ownerAddress,
              isActive: wallet.isActive,
              isAvailable: wallet.isAvailable,
              walletIndex: wallet.walletIndex,
              accounts: wallet.accounts,
            },
            null,
            2
          )}
        </pre>
        {wallet.isActive ? (
          <p className="text-xs text-green-700">Active wallet</p>
        ) : (
          <p className="text-xs opacity-70">
            Click to set this wallet as active. (
            <Link to="/wallet/useEthereumEmbeddedWallet" search={{ focus: 'setActive' }}>
              setActive
            </Link>
            )
          </p>
        )}
      </div>
    </TooltipContent>
  </Tooltip>
)

type EmbeddedWalletsListProps = {
  ethereum: EthereumWalletState
  activeWallet: ConnectedEmbeddedEthereumWallet | null
  connectingAddress: string | undefined
  setActive: (opts: { address: `0x${string}`; password?: string; recoveryMethod?: RecoveryMethod }) => Promise<void>
  isExternalActive?: boolean
}

export function EmbeddedWalletsList({
  ethereum,
  activeWallet,
  connectingAddress,
  setActive,
  isExternalActive,
}: EmbeddedWalletsListProps) {
  const { updateEmbeddedAccounts } = useOpenfort()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await updateEmbeddedAccounts()
    } finally {
      setIsRefreshing(false)
    }
  }

  // Smart Accounts and Delegated Accounts are deployed per EVM chain, so they
  // should only appear on the chain they were created on. EOAs exist on every
  // EVM chain and always remain visible. Solana is unaffected (separate list).
  const currentChainId = ethereum.status === 'connected' && 'chainId' in ethereum ? ethereum.chainId : undefined
  const wallets = useMemo(() => {
    if (currentChainId == null) return ethereum.wallets
    return ethereum.wallets.filter((w) => {
      if (w.accountType === AccountTypeEnum.EOA) return true
      const chainScopedAccounts = w.accounts?.filter((a) => a.chainId != null) ?? []
      if (chainScopedAccounts.length === 0) return true
      return chainScopedAccounts.some((a) => a.chainId === currentChainId)
    })
  }, [ethereum.wallets, currentChainId])

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

  // When an external wallet is active, suppress embedded active indicators
  const effectiveActiveWallet = isExternalActive ? null : activeWallet

  return (
    <div className="space-y-2">
      {topLevel.map((wallet) => {
        const children = childrenByOwner.get(wallet.address.toLowerCase())
        const walletIndex = wallets.indexOf(wallet)
        const displayWallet = isExternalActive ? { ...wallet, isActive: false } : wallet
        return (
          <div key={wallet.id} className="space-y-1">
            <WalletTooltipItem
              wallet={displayWallet}
              index={walletIndex}
              activeWallet={effectiveActiveWallet}
              connectingAddress={connectingAddress}
              setActive={setActive}
            />
            {children?.map((child) => {
              const displayChild = isExternalActive ? { ...child, isActive: false } : child
              return (
                <WalletTooltipItem
                  key={child.id}
                  wallet={displayChild}
                  index={wallets.indexOf(child)}
                  activeWallet={effectiveActiveWallet}
                  connectingAddress={connectingAddress}
                  setActive={setActive}
                  nested
                />
              )
            })}
          </div>
        )
      })}
      <div className="flex gap-2">
        <div className="flex-1">
          <CreateWalletButton ethereum={ethereum} />
        </div>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="self-start"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCwIcon className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh wallets</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
