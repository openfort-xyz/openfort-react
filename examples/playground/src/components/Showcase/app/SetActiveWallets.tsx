import type { RecoveryMethod } from '@openfort/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveEthereumEmbeddedWallet } from '@/hooks/useActiveEthereumEmbeddedWallet'
import { EmbeddedWalletsList } from './EmbeddedWalletsList'

export const SetActiveWalletsCardEthereum = () => {
  const { ethereum, activeWallet, connectingAddress } = useActiveEthereumEmbeddedWallet()
  const setActive = async (opts: { address: `0x${string}`; password?: string; recoveryMethod?: RecoveryMethod }) => {
    await ethereum.setActive(opts)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallets</CardTitle>
        <CardDescription>Create and switch embedded wallets (useEthereumEmbeddedWallet).</CardDescription>
      </CardHeader>
      <CardContent>
        <EmbeddedWalletsList
          ethereum={ethereum}
          activeWallet={activeWallet}
          connectingAddress={connectingAddress}
          setActive={setActive}
        />
      </CardContent>
    </Card>
  )
}
