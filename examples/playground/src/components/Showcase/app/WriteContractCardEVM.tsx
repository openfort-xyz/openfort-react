import { AccountTypeEnum, embeddedWalletId } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { getAddress, parseAbi } from 'viem'
import { useAccount } from 'wagmi'
import { useConnectedEthereumAccount } from '@/hooks/useConnectedEthereumAccount'
import { useEthereumReadContractLocal, useEthereumWriteContractLocal } from '@/hooks/useEthereumAdapterHooks'
import { BALANCE_ABI, getMintContractConfig } from '@/lib/contracts'
import { delegatedImplLabel, isDelegatedAccountUsableOnChain } from '@/lib/delegation'
import { WriteContractLayout } from './write-contract-shared'

export const WriteContractCardEVM = ({ hook }: { hook?: string }) => {
  const { address, chainId } = useConnectedEthereumAccount()
  const { connector } = useAccount()
  const ethereum = useEthereumEmbeddedWallet()
  const isExternalWallet = !!connector && connector.id !== embeddedWalletId
  const isEoa =
    !isExternalWallet && ethereum.status === 'connected' && ethereum.activeWallet?.accountType === AccountTypeEnum.EOA
  const { data: hash, writeContract, isPending, error } = useEthereumWriteContractLocal()
  const config = getMintContractConfig(chainId ?? undefined)

  // Inform (don't block) when a legacy delegated account can't transact on the current chain
  // (e.g. a Calibur V8 wallet on Polygon Amoy). New wallets are CaliburV9 and work everywhere.
  const activeImplType =
    !isExternalWallet && ethereum.status === 'connected' ? ethereum.activeWallet?.implementationType : undefined
  const unusableOnChain = !isExternalWallet && !isDelegatedAccountUsableOnChain(activeImplType, chainId ?? undefined)
  const portabilityWarning = unusableOnChain
    ? `This wallet (${delegatedImplLabel(activeImplType)}) isn't available on this chain, so minting will fail here. Create a new wallet — new wallets work on every chain.`
    : undefined

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
      disabledReason={isEoa ? 'Minting requires a Smart Account or Delegated Account (gas sponsorship)' : undefined}
      warning={portabilityWarning}
    />
  )
}
