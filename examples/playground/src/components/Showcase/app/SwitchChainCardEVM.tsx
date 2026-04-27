import { embeddedWalletId, useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { numberToHex } from 'viem'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { Button } from '@/components/Showcase/ui/Button'
import { InputMessage } from '@/components/Showcase/ui/InputMessage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PLAYGROUND_EVM_CHAINS } from '@/lib/chains'
import { toError } from '@/lib/errors'

export const SwitchChainCardEVM = ({ tooltip }: { tooltip?: { hook: string; body: ReactNode } }) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Switch chain</CardTitle>
        <CardDescription>Switch between different chains to interact with various blockchain networks.</CardDescription>
        <p className="text-sm text-muted-foreground">
          Current chain: {chainName}
          {currentChainId != null && ` (${currentChainId})`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {PLAYGROUND_EVM_CHAINS.map((chain) => (
            <div key={chain.id}>
              {tooltip ? (
                <Tooltip delayDuration={500}>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        className="btn btn-accent"
                        onClick={() => switchChain(chain.id)}
                        disabled={currentChainId === chain.id || isPending || !canSwitch}
                      >
                        Switch to {chain.name}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <h3 className="text-base mb-1">{tooltip.hook}</h3>
                    {tooltip.body}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  className="btn btn-accent"
                  onClick={() => switchChain(chain.id)}
                  disabled={currentChainId === chain.id || isPending || !canSwitch}
                >
                  Switch to {chain.name}
                </Button>
              )}
            </div>
          ))}

          <InputMessage message={`Switched to chain ${data?.name}`} show={!!data} variant="success" />
          <InputMessage
            message={error?.message || 'An error occurred while switching chains.'}
            show={!!error}
            variant="error"
          />
        </div>
      </CardContent>
    </Card>
  )
}
