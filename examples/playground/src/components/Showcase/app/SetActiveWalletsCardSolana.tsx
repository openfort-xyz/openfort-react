import { RecoveryMethod } from '@openfort/react'
import { useSolanaEmbeddedWallet } from '@openfort/react/solana'
import { Link } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { EyeIcon, EyeOffIcon, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MP } from '@/components/motion/motion'
import { WalletRecoveryIcon } from '@/components/Showcase/app/WalletRecoveryIcon'
import { TruncatedText } from '@/components/TruncatedText'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type EmbeddedWalletItem = ReturnType<typeof useSolanaEmbeddedWallet>['wallets'][number]

const CreateWalletButton = ({ solana }: { solana: ReturnType<typeof useSolanaEmbeddedWallet> }) => {
  const isCreating = solana.status === 'creating'
  const create = solana.create
  const error = solana.status === 'error' ? solana.error : null
  const [chooseCreateMethodOpen, setChooseCreateMethodOpen] = useState(false)
  const [creatingMethod, setCreatingMethod] = useState<RecoveryMethod | null>(null)

  useEffect(() => {
    const handleClickOutsideCreateWallet = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.create-wallet-button')) {
        setChooseCreateMethodOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutsideCreateWallet)

    return () => {
      document.removeEventListener('click', handleClickOutsideCreateWallet)
    }
  }, [])

  return (
    <>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <div className="flex w-full gap-2">
            {chooseCreateMethodOpen ? (
              <>
                <Button
                  type="button"
                  className="flex-1 create-wallet-button"
                  onClick={() => {
                    create()
                    setCreatingMethod(RecoveryMethod.AUTOMATIC)
                  }}
                  disabled={isCreating}
                >
                  <WalletRecoveryIcon recovery={RecoveryMethod.AUTOMATIC} />
                  Automatic
                </Button>
                <Button
                  type="button"
                  className="flex-1 create-wallet-button"
                  onClick={() => {
                    setCreatingMethod(RecoveryMethod.PASSWORD)
                    create({
                      recoveryMethod: RecoveryMethod.PASSWORD,
                      password: 'example-password',
                    })
                  }}
                  disabled={isCreating}
                >
                  <WalletRecoveryIcon recovery={RecoveryMethod.PASSWORD} />
                  Password
                </Button>
                <Button
                  type="button"
                  className="flex-1 create-wallet-button"
                  onClick={() => {
                    setCreatingMethod(RecoveryMethod.PASSKEY)
                    create({
                      recoveryMethod: RecoveryMethod.PASSKEY,
                    })
                  }}
                  disabled={isCreating}
                >
                  <WalletRecoveryIcon recovery={RecoveryMethod.PASSKEY} />
                  Passkey
                </Button>
              </>
            ) : (
              <Button
                type="button"
                className="w-full create-wallet-button"
                onClick={() => {
                  if (!isCreating) setChooseCreateMethodOpen(true)
                }}
                disabled={isCreating}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <span className="mr-2">+</span>}
                {isCreating ? `Creating${creatingMethod ? ` (${creatingMethod})` : ''}…` : 'Create new wallet'}
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <h3 className="text-base mb-1">useSolanaEmbeddedWallet</h3>
          Create a new Solana wallet using the{' '}
          <Link to="/wallet/useSolanaEmbeddedWallet" search={{ focus: 'create' }} className="px-1 group">
            create
          </Link>{' '}
          function.
        </TooltipContent>
      </Tooltip>
      <AnimatePresence mode="wait">
        {isCreating && (
          <MP
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 0.8,
              scale: 0.95,
            }}
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
  activeWallet,
  connectingAddress,
  setActive,
}: {
  wallet: EmbeddedWalletItem
  activeWallet: EmbeddedWalletItem | null
  connectingAddress: string | undefined
  setActive: ReturnType<typeof useSolanaEmbeddedWallet>['setActive']
}) => {
  const isConnecting = connectingAddress != null && connectingAddress.toLowerCase() === wallet.address.toLowerCase()
  const [password, setPassword] = useState('example-password')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    const handleClickOutsidePassword = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.password-input')) {
        setShowPasswordInput(false)
      }
    }

    document.addEventListener('click', handleClickOutsidePassword)

    return () => {
      document.removeEventListener('click', handleClickOutsidePassword)
    }
  }, [])

  const isActive = activeWallet != null && activeWallet.address.toLowerCase() === wallet.address.toLowerCase()

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
      <form className="flex w-full gap-2 password-input">
        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter password"
          className="password-input"
          value={password}
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
    <Button
      type="button"
      variant="outline"
      onClick={() => !isActive && handleClickWallet()}
      className={cn('w-full justify-between password-input', {
        'border-primary bg-primary/10 text-primary hover:bg-primary/15': isActive,
        'animate-pulse': isConnecting,
      })}
    >
      Openfort
      {isConnecting && (
        <MP
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{
            opacity: 0.8,
            scale: 0.95,
          }}
        >
          Connecting...
        </MP>
      )}
      <div className="flex items-center gap-2">
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
  )
}

export const SetActiveWalletsCardSolana = () => {
  const solana = useSolanaEmbeddedWallet()
  const wallets = solana.wallets
  const connectedAddress = solana.status === 'connected' ? solana.address : undefined
  const activeWalletFromHook =
    solana.status === 'connected' ||
    solana.status === 'connecting' ||
    solana.status === 'reconnecting' ||
    solana.status === 'needs-recovery'
      ? solana.activeWallet
      : null
  const activeWallet =
    activeWalletFromHook != null
      ? activeWalletFromHook
      : connectedAddress != null
        ? (wallets.find((w) => w.address.toLowerCase() === connectedAddress.toLowerCase()) ?? null)
        : null
  const connectingAddress =
    solana.status === 'connecting' || solana.status === 'reconnecting' ? solana.activeWallet?.address : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallets</CardTitle>
        <CardDescription>Create and switch embedded Solana wallets (useSolanaEmbeddedWallet).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {solana.status === 'fetching-wallets' && <p className="text-sm text-muted-foreground">Loading wallets...</p>}
          {wallets.map((w) => (
            <Tooltip delayDuration={500} key={w.address}>
              <TooltipTrigger asChild>
                <div>
                  <WalletButton
                    wallet={w}
                    activeWallet={activeWallet}
                    connectingAddress={connectingAddress}
                    setActive={solana.setActive}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="flex flex-col gap-1">
                  <h3 className="text-base mb-1">useSolanaEmbeddedWallet</h3>
                  <pre className="flex text-xs flex-col gap-1">
                    wallet ={' '}
                    {JSON.stringify({ id: w.id, address: w.address, recoveryMethod: w.recoveryMethod }, null, 2)}
                  </pre>
                  {activeWallet?.address.toLowerCase() === w.address.toLowerCase() ? (
                    <p className="text-xs text-green-700">Active wallet</p>
                  ) : (
                    <p className="text-xs opacity-70">
                      Click to set this wallet as active. (
                      <Link to="/wallet/useSolanaEmbeddedWallet" search={{ focus: 'setActive' }}>
                        setActive
                      </Link>
                      )
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          ))}

          <CreateWalletButton solana={solana} />
        </div>
      </CardContent>
    </Card>
  )
}
