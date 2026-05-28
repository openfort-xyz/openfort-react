import { AccountTypeEnum, embeddedWalletId, useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useState } from 'react'
import { encodeFunctionData, getAddress, parseAbi } from 'viem'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { useConnectedEthereumAccount } from '@/hooks/useConnectedEthereumAccount'
import { BALANCE_ABI, getMintContractConfig } from '@/lib/contracts'
import { toError } from '@/lib/errors'
import { WriteContractLayout } from './write-contract-shared'

export const WriteContractCard = ({ hook }: { hook?: string }) => {
  const { address, chainId } = useConnectedEthereumAccount()
  const { isConnected, connector } = useAccount()
  const config = getMintContractConfig(chainId)
  const core = useOpenfort()
  const embedded = useEthereumEmbeddedWallet()

  const [localHash, setLocalHash] = useState<`0x${string}` | null>(null)
  const [localError, setLocalError] = useState<Error | null>(null)
  const [localPending, setLocalPending] = useState(false)

  const {
    data: balance,
    refetch,
    error: balanceError,
  } = useReadContract({
    address: (config?.address ?? undefined) as `0x${string}` | undefined,
    abi: BALANCE_ABI,
    functionName: 'balanceOf',
    args: config && address ? [address] : undefined,
  })

  const {
    data: wagmiHash,
    isPending: wagmiPending,
    writeContract,
    error: wagmiError,
  } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setTimeout(() => {
          refetch()
        }, 100)
      },
    },
  })

  const isExternalWallet = !!connector && connector.id !== embeddedWalletId
  const embeddedAccountType =
    !isExternalWallet && embedded.status === 'connected' ? embedded.activeWallet?.accountType : undefined
  const requiresSmartAccount =
    embeddedAccountType === AccountTypeEnum.EOA || embeddedAccountType === AccountTypeEnum.DELEGATED_ACCOUNT
  const useWagmiWrite = isConnected && connector?.id !== embeddedWalletId
  const hash = useWagmiWrite ? wagmiHash : (localHash ?? undefined)
  const isPending = useWagmiWrite ? wagmiPending : localPending
  const error = useWagmiWrite ? wagmiError : localError

  async function submit(amount: string) {
    if (!config?.address || !address) return
    const amountWei = BigInt(amount) * BigInt(10 ** 18)
    const contractAddress = getAddress(config.address) as `0x${string}`

    if (useWagmiWrite) {
      if (config.type === 'claim') {
        writeContract({
          address: contractAddress,
          abi: parseAbi(['function claim(uint256 amount)']),
          functionName: 'claim',
          args: [amountWei],
        })
      } else {
        writeContract({
          address: contractAddress,
          abi: parseAbi(['function mint(address to, uint256 amount)']),
          functionName: 'mint',
          args: [address, amountWei],
        })
      }
      return
    }

    setLocalPending(true)
    setLocalError(null)
    setLocalHash(null)
    try {
      const provider =
        embedded.status === 'connected' && embedded.activeWallet
          ? await embedded.activeWallet.getProvider()
          : await core.client.embeddedWallet.getEthereumProvider()

      const abi =
        config.type === 'claim'
          ? parseAbi(['function claim(uint256 amount)'])
          : parseAbi(['function mint(address to, uint256 amount)'])
      const functionName = config.type === 'claim' ? 'claim' : 'mint'
      const args =
        config.type === 'claim' ? ([amountWei] as const) : ([address, amountWei] as [typeof address, typeof amountWei])

      const dataEncoded = encodeFunctionData({ abi, functionName, args })
      const txHash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: contractAddress, data: dataEncoded }],
      })) as `0x${string}`

      setLocalHash(txHash)
      setTimeout(() => refetch(), 100)
    } catch (err) {
      setLocalError(toError(err))
    } finally {
      setLocalPending(false)
    }
  }

  return (
    <WriteContractLayout
      hook={hook}
      config={config}
      address={address}
      chainId={chainId}
      balance={balance as bigint | undefined}
      balanceError={balanceError}
      hash={hash}
      isPending={isPending}
      error={error}
      onSubmit={submit}
      disabledReason={
        requiresSmartAccount
          ? embeddedAccountType === AccountTypeEnum.DELEGATED_ACCOUNT
            ? 'Minting from Delegated Accounts is coming soon — switch to a Smart Account to mint today.'
            : 'Minting requires a Smart Account (gas sponsorship). Delegated support coming soon.'
          : undefined
      }
    />
  )
}
