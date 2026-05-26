import { embeddedWalletId, useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useState } from 'react'
import { createWalletClient, custom } from 'viem'
import { useAccount, useSignMessage } from 'wagmi'
import { useConnectedEthereumAccount } from '@/hooks/useConnectedEthereumAccount'
import { toError } from '@/lib/errors'
import { SignaturesLayout } from './signatures-shared'

export const SignaturesCard = ({ hook }: { hook?: string }) => {
  const { address } = useConnectedEthereumAccount()
  const { isConnected, connector } = useAccount()
  const {
    data: wagmiData,
    signMessage: wagmiSignMessage,
    isPending: wagmiPending,
    error: wagmiErrorObj,
  } = useSignMessage()

  const core = useOpenfort()
  const embedded = useEthereumEmbeddedWallet()
  const [localSignature, setLocalSignature] = useState<string | null>(null)
  const [localError, setLocalError] = useState<Error | null>(null)
  const [localPending, setLocalPending] = useState(false)

  const useWagmiSign = isConnected && !!connector && connector.id !== embeddedWalletId
  const isPending = useWagmiSign ? wagmiPending : localPending
  const signature = useWagmiSign ? wagmiData : localSignature
  const error = useWagmiSign ? wagmiErrorObj : localError

  const handleSign = async (message: string) => {
    if (!address) return

    if (useWagmiSign) {
      wagmiSignMessage({ message })
      return
    }

    setLocalPending(true)
    setLocalError(null)
    setLocalSignature(null)
    try {
      const provider =
        embedded.status === 'connected' && embedded.activeWallet
          ? await embedded.activeWallet.getProvider()
          : await core.client.embeddedWallet.getEthereumProvider()

      const walletClient = createWalletClient({
        account: address,
        transport: custom(provider),
      })
      const sig = await walletClient.signMessage({
        account: address,
        message,
      })
      setLocalSignature(sig)
    } catch (err) {
      setLocalError(toError(err))
    } finally {
      setLocalPending(false)
    }
  }

  return (
    <SignaturesLayout
      hook={hook}
      isPending={isPending}
      canSign={!!address}
      signature={signature ?? undefined}
      error={error}
      onSubmit={handleSign}
    />
  )
}
