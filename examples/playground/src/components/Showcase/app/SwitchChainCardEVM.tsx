import { embeddedWalletId, useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useState } from 'react'
import { numberToHex } from 'viem'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { HookBadge } from '@/components/HookBadge'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getEvmChainsForKey, PLAYGROUND_EVM_CHAINS } from '@/lib/chains'
import { delegatedImplLabel, isDelegatedAccountUsableOnChain } from '@/lib/delegation'
import { toError } from '@/lib/errors'

export const SwitchChainCardEVM = ({ hook, bare }: { hook?: string; bare?: boolean }) => {
  const embedded = useEthereumEmbeddedWallet()
  const core = useOpenfort()
  const { isConnected: wagmiConnected, connector } = useAccount()
  const wagmiChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<{ id: number; name: string } | null>(null)

  const isExternalWallet = wagmiConnected && !!connector && connector.id !== embeddedWalletId
  const currentChainId = isExternalWallet
    ? wagmiChainId
    : embedded.status === 'connected'
      ? embedded.chainId
      : undefined
  const canSwitch = isExternalWallet || embedded.status === 'connected' || !!core.activeEmbeddedAddress

  // Match the chain list to the publishable key: test keys (`pk_test_…`) only
  // list testnet chains, live keys (`pk_live_…`) only mainnet chains. The key is
  // public (it ships to the client), so reading it from env here mirrors how the
  // other showcase cards source it.
  const visibleChains = getEvmChainsForKey(import.meta.env.VITE_OPENFORT_PUBLISHABLE_KEY)

  // Implementation type of the active embedded (delegated) account, if any. Used to inform
  // — never block — when the current wallet can't transact on a target chain (e.g. a legacy
  // Calibur V8 wallet on Polygon Amoy). External wallets are always considered portable here.
  const activeImplType =
    !isExternalWallet && embedded.status === 'connected' ? embedded.activeWallet?.implementationType : undefined

  const switchChain = async (targetChainId: number) => {
    if (!canSwitch) {
      setError(new Error('Wallet not connected'))
      return
    }

    setIsPending(true)
    setError(null)
    setData(null)

    try {
      if (isExternalWallet) {
        await switchChainAsync({ chainId: targetChainId })
      } else {
        const provider =
          embedded.status === 'connected' && embedded.activeWallet
            ? await embedded.activeWallet.getProvider()
            : await core.client.embeddedWallet.getEthereumProvider()
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ account: embedded.activeWallet?.accountId, chainId: numberToHex(targetChainId) }],
        })
      }

      const chain = PLAYGROUND_EVM_CHAINS.find((c) => c.id === targetChainId)
      setData(chain ? { id: chain.id, name: chain.name } : { id: targetChainId, name: `Chain ${targetChainId}` })
    } catch (err) {
      const e = toError(err)
      setError(e)
    } finally {
      setIsPending(false)
    }
  }

  const chainName =
    PLAYGROUND_EVM_CHAINS.find((chain) => chain.id === currentChainId)?.name ||
    (currentChainId != null ? `Chain ${currentChainId}` : 'Unknown')

  const body = (
    <div className="space-y-2">
      {visibleChains.map((chain) => {
        const usableOnChain = isDelegatedAccountUsableOnChain(activeImplType, chain.id)
        return (
          <div key={chain.id}>
            <Button
              onClick={() => switchChain(chain.id)}
              disabled={currentChainId === chain.id || isPending || !canSwitch}
            >
              Switch to {chain.name}
            </Button>
            <InputMessage
              message={`Heads up: this wallet (${delegatedImplLabel(activeImplType)}) can't transact on ${chain.name}. You can still switch, but to mint here create a new wallet — new wallets work on every chain.`}
              show={!usableOnChain}
              variant="warning"
            />
          </div>
        )
      })}

      <InputMessage message={`Switched to chain ${data?.name}`} show={!!data} variant="success" />
      <InputMessage
        message={error?.message || 'An error occurred while switching chains.'}
        show={!!error}
        variant="error"
      />
    </div>
  )

  if (bare) {
    return (
      <>
        <p className="text-xs text-muted-foreground">
          Current chain: {chainName}
          {currentChainId != null && ` (${currentChainId})`}
        </p>
        {body}
      </>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Switch chain</CardTitle>
        <CardDescription>Switch between different chains to interact with various blockchain networks.</CardDescription>
        <p className="text-sm text-muted-foreground">
          Current chain: {chainName}
          {currentChainId != null && ` (${currentChainId})`}
        </p>
        {hook && <HookBadge hook={hook} className="mt-1" />}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
