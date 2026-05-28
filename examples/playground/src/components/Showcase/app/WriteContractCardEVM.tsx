import { AccountTypeEnum, embeddedWalletId } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { getAddress, parseAbi } from 'viem'
import { useAccount } from 'wagmi'
import { useConnectedEthereumAccount } from '@/hooks/useConnectedEthereumAccount'
import { useEthereumReadContractLocal, useEthereumWriteContractLocal } from '@/hooks/useEthereumAdapterHooks'
import { BALANCE_ABI, getMintContractConfig } from '@/lib/contracts'
import { WriteContractLayout } from './write-contract-shared'

export const WriteContractCardEVM = ({ hook }: { hook?: string }) => {
  const { address, chainId } = useConnectedEthereumAccount()
  const { connector } = useAccount()
  const ethereum = useEthereumEmbeddedWallet()
  const isExternalWallet = !!connector && connector.id !== embeddedWalletId
  const embeddedAccountType =
    !isExternalWallet && ethereum.status === 'connected' ? ethereum.activeWallet?.accountType : undefined
  const requiresSmartAccount =
    embeddedAccountType === AccountTypeEnum.EOA || embeddedAccountType === AccountTypeEnum.DELEGATED_ACCOUNT
  const { data: hash, writeContract, isPending, error } = useEthereumWriteContractLocal()
  const config = getMintContractConfig(chainId ?? undefined)

  const {
    data: balance,
    refetch,
    error: balanceError,
  } = useEthereumReadContractLocal({
    address: config?.address as `0x${string}`,
    abi: BALANCE_ABI,
    functionName: 'balanceOf',
    args: config && address ? [address] : undefined,
    chainId: chainId ?? undefined,
  })

  async function submit(amount: string) {
    if (!address || !config) return
    const amountWei = BigInt(amount) * BigInt(10 ** 18)
    if (config.type === 'claim') {
      await writeContract({
        address: getAddress(config.address),
        abi: parseAbi(['function claim(uint256 amount)']),
        functionName: 'claim',
        args: [amountWei],
      })
    } else {
      await writeContract({
        address: getAddress(config.address),
        abi: parseAbi(['function mint(address to, uint256 amount)']),
        functionName: 'mint',
        args: [address, amountWei],
      })
    }
    setTimeout(refetch, 100)
  }

  return (
    <WriteContractLayout
      hook={hook}
      config={config}
      address={address}
      chainId={chainId}
      balance={balance as bigint | undefined}
      balanceError={balanceError ? (balanceError as Error) : undefined}
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
