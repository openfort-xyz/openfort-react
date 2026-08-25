import type { RecoveryMethod } from '@openfort/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveEthereumEmbeddedWallet } from '@/hooks/useActiveEthereumEmbeddedWallet'
import { EmbeddedWalletsList } from './EmbeddedWalletsList'

export const SetActiveWalletsCardEthereum = ({ bare }: { bare?: boolean } = {}) => {
  const { ethereum, activeWallet, connectingAddress } = useActiveEthereumEmbeddedWallet()
  const setActive = async (opts: { address: `0x${string}`; password?: string; recoveryMethod?: RecoveryMethod }) => {
    await ethereum.setActive(opts)
  }

  const body = (
    <EmbeddedWalletsList
      ethereum={ethereum}
      activeWallet={activeWallet}
      connectingAddress={connectingAddress}
      setActive={setActive}
    />
  )

  if (bare) return body

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallets</CardTitle>
        <CardDescription>Create and switch embedded wallets (useEthereumEmbeddedWallet).</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
