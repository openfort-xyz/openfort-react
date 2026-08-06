import type { RecoveryMethod } from '@openfort/react'
import { embeddedWalletId, useOpenfort, useUser } from '@openfort/react'
import { useWalletAuth } from '@openfort/react/wagmi'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveEthereumEmbeddedWallet } from '@/hooks/useActiveEthereumEmbeddedWallet'
import { cn } from '@/lib/cn'
import { EmbeddedWalletsList } from './EmbeddedWalletsList'

const FALLBACK_CONNECTOR_ICONS: Record<string, React.ReactNode> = {
  coinbaseWallet: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <title>Coinbase Wallet</title>
      <circle cx="10" cy="10" r="10" fill="#1652F0" />
      <path
        d="M10 4C6.686 4 4 6.686 4 10C4 13.314 6.686 16 10 16C13.314 16 16 13.314 16 10C16 6.686 13.314 4 10 4ZM8.25 7.75H11.75C12.5 8.0858 12.5 8.5V11.5C12.5 11.9142 12.1642 12.25 11.75 12.25H8.25C7.8358 12.25 7.5 11.9142 7.5 11.5V8.5C7.5 8.0858 7.8358 7.75 8.25 7.75Z"
        fill="white"
      />
    </svg>
  ),
  coinbaseWalletSDK: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <title>Coinbase Wallet</title>
      <circle cx="10" cy="10" r="10" fill="#1652F0" />
      <path
        d="M10 4C6.686 4 4 6.686 4 10C4 13.314 6.686 16 10 16C13.314 16 16 13.314 16 10C16 6.686 13.314 4 10 4ZM8.25 7.75H11.75C12.5 8.0858 12.5 8.5V11.5C12.5 11.9142 12.1642 12.25 11.75 12.25H8.25C7.8358 12.25 7.5 11.9142 7.5 11.5V8.5C7.5 8.0858 7.8358 7.75 8.25 7.75Z"
        fill="white"
      />
    </svg>
  ),
  walletConnect: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: '#3B99FC', borderRadius: '50%' }}
      aria-hidden
    >
      <title>WalletConnect</title>
      <path
        d="M9.58818 11.8556C13.1293 8.31442 18.8706 8.31442 22.4117 11.8556L22.8379 12.2818C23.015 12.4588 23.015 12.7459 22.8379 12.9229L21.3801 14.3808C21.2915 14.4693 21.148 14.4693 21.0595 14.3808L20.473 13.7943C18.0026 11.3239 13.9973 11.3239 11.5269 13.7943L10.8989 14.4223C10.8104 14.5109 10.6668 14.5109 10.5783 14.4223L9.12041 12.9645C8.94336 12.7875 8.94336 12.5004 9.12041 12.3234L9.58818 11.8556ZM25.4268 14.8706L26.7243 16.1682C26.9013 16.3452 26.9013 16.6323 26.7243 16.8093L20.8737 22.6599C20.6966 22.8371 20.4096 22.8371 20.2325 22.6599L16.0802 18.5076C16.0359 18.4634 15.9641 18.4634 15.9199 18.5076L11.7675 22.6599C11.5905 22.8371 11.3034 22.8371 11.1264 22.66L5.27561 16.8092C5.09856 16.6322 5.09856 16.3451 5.27561 16.168L6.57313 14.8706C6.75019 14.6934 7.03726 14.6934 7.21431 14.8706L11.3668 19.023C11.411 19.0672 11.4828 19.0672 11.5271 19.023L15.6793 14.8706C15.8563 14.6934 16.1434 14.6934 16.3205 14.8706L20.473 19.023C20.5172 19.0672 20.589 19.0672 20.6332 19.023L24.7856 14.8706C24.9627 14.6935 25.2498 14.6935 25.4268 14.8706Z"
        fill="white"
      />
    </svg>
  ),
}

const SimpleWalletButton = ({
  children,
  isActive,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  isActive: boolean
  disabled?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'w-full flex items-center justify-start gap-3 py-2 px-3 rounded-md text-sm transition-colors',
      isActive ? 'bg-muted text-foreground' : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
      disabled && 'opacity-60 cursor-not-allowed'
    )}
  >
    {children}
  </button>
)

/**
 * Unified wallet card: External (left) | Embedded (right).
 * - External: wagmi connectors, click to switch.
 * - Embedded: list of wallets with password/passkey recovery, create button.
 */
export const ConnectExternalWalletCard = () => {
  const { connect, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { connector } = useAccount()
  const { setActiveEmbeddedAddress } = useOpenfort()
  const { ethereum, activeWallet, connectingAddress } = useActiveEthereumEmbeddedWallet()
  const { availableWallets: externalConnectors } = useWalletAuth()
  const { linkedAccounts } = useUser()

  const signedInWithWallet = linkedAccounts.some((a) => a.provider === 'wallet' || a.provider === 'siwe')

  const openfortConnector = connectors.find((c) => c.id === embeddedWalletId || c.name === 'Openfort')
  const isOpenfortActive = ethereum.status === 'connected' && (connector?.id === embeddedWalletId || !connector)
  const isExternalActive = !!connector && connector.id !== embeddedWalletId
  const isBusy = ethereum.isLoading

  const setActive = async (opts: { address: `0x${string}`; recoveryMethod?: RecoveryMethod; password?: string }) => {
    const result = await ethereum.setActive(opts)
    if (result.error) throw result.error
    if (result.needsRecovery) return
    if (connector?.id !== embeddedWalletId && openfortConnector) {
      await disconnectAsync()
      connect({ connector: openfortConnector })
    }
  }

  const handleSelectExternal = (connectorId: string) => {
    if (isBusy) return
    setActiveEmbeddedAddress(undefined)
    const wagmiConnector = connectors.find((c) => c.id === connectorId)
    if (wagmiConnector) connect({ connector: wagmiConnector })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallets</CardTitle>
        <CardDescription>
          {signedInWithWallet ? 'Switch between external wallets.' : 'Manage your embedded wallets.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4">
          {/* ── External (only when signed in with wallet) ── */}
          {signedInWithWallet && (
            <div
              className={cn(
                'rounded-md border p-3 transition-colors',
                isExternalActive ? 'border-base-300' : 'border-base-200 opacity-90'
              )}
            >
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">External</p>
              <div className="flex flex-col gap-0.5">
                {externalConnectors.map((c) => {
                  const isActive = isExternalActive && connector?.id === c.id
                  const iconSrc = typeof c.icon === 'string' ? c.icon : undefined
                  const iconNode =
                    (typeof c.icon !== 'string' && c.icon != null ? c.icon : null) ??
                    FALLBACK_CONNECTOR_ICONS[c.id] ??
                    null

                  return (
                    <SimpleWalletButton
                      key={c.id}
                      isActive={!!isActive}
                      disabled={!!isActive || isBusy}
                      onClick={() => handleSelectExternal(c.id)}
                    >
                      {iconSrc ? (
                        <span className="h-5 w-5 flex shrink-0">
                          <img src={iconSrc} alt="" className="h-full w-full object-contain" />
                        </span>
                      ) : iconNode ? (
                        <span className="h-5 w-5 flex shrink-0 [&>svg]:h-full [&>svg]:w-full [&>img]:h-full [&>img]:w-full [&>img]:object-contain">
                          {iconNode}
                        </span>
                      ) : (
                        <span className="h-5 w-5 rounded bg-muted flex items-center justify-center text-[10px] font-medium">
                          {c.name?.[0] ?? c.id?.[0] ?? '?'}
                        </span>
                      )}
                      <span>{c.name ?? c.id}</span>
                      {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-green-500" />}
                    </SimpleWalletButton>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Embedded (only when NOT signed in with wallet) ── */}
          {!signedInWithWallet && (
            <div
              className={cn(
                'rounded-md border p-3 transition-colors',
                isOpenfortActive ? 'border-base-300' : 'border-base-200 opacity-90'
              )}
            >
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Embedded</p>
              <div className="flex flex-col gap-0.5">
                {ethereum.status === 'fetching-wallets' ? (
                  <p className="text-xs text-muted-foreground py-2 px-3">Loading wallets...</p>
                ) : (
                  <EmbeddedWalletsList
                    ethereum={ethereum}
                    activeWallet={activeWallet}
                    connectingAddress={connectingAddress}
                    setActive={setActive}
                    isExternalActive={isExternalActive}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status feedback */}
        {isBusy && <p className="text-xs text-muted-foreground text-center mt-3 animate-pulse">Switching wallet...</p>}
        {ethereum.status === 'error' && ethereum.error && (
          <p className="text-xs text-red-500 text-center mt-3">{ethereum.error}</p>
        )}
      </CardContent>
    </Card>
  )
}
