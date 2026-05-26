import { useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useState } from 'react'
import { createWalletClient, custom } from 'viem'
import { useDisplayEthereumAddress } from '@/hooks/useConnectedEthereumAccount'
import { toError } from '@/lib/errors'
import { SignaturesLayout } from './signatures-shared'

export const SignaturesCardEVM = ({ hook }: { hook?: string }) => {
  const core = useOpenfort()
  const address = useDisplayEthereumAddress()
  const { status, activeWallet } = useEthereumEmbeddedWallet()
  const [data, setData] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const handleSign = async (message: string) => {
    if (!address) {
      setError(new Error('Wallet not connected'))
      return
    }

    setIsPending(true)
    setError(null)
    setData(null)

    try {
      const provider =
        status === 'connected' && activeWallet
          ? await activeWallet.getProvider()
          : await core.client.embeddedWallet.getEthereumProvider()

      const walletClient = createWalletClient({
        account: address,
        transport: custom(provider),
      })

      const signature = await walletClient.signMessage({
        account: address,
        message,
      })

      setData(signature)
    } catch (err) {
      setError(toError(err))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <SignaturesLayout
      hook={hook}
      isPending={isPending}
      canSign={!!address}
      signature={data ?? undefined}
      error={error}
      onSubmit={handleSign}
    />
  )
}
