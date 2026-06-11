import { getAddress, parseAbi } from 'viem'
import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi'

import { TruncateData } from '../../../components/ui/TruncateData'
import { getMintContractConfig } from '../../../lib/contracts'

function MintContract() {
  const { address } = useAccount()
  const chainId = useChainId()
  const config = getMintContractConfig(chainId)

  const {
    data: balance,
    refetch,
    error: balanceError,
  } = useReadContract({
    address: (config?.address ?? undefined) as `0x${string}` | undefined,
    abi: [
      {
        type: 'function',
        name: 'balanceOf',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
      },
    ],
    functionName: 'balanceOf',
    args: config && address ? [address] : undefined,
  })

  const { data: tokenSymbol } = useReadContract({
    address: (config?.address ?? undefined) as `0x${string}` | undefined,
    abi: [
      {
        type: 'function',
        name: 'symbol',
        stateMutability: 'view',
        outputs: [{ type: 'string' }],
      },
    ],
    functionName: 'symbol',
  })

  const {
    data: hash,
    isPending,
    writeContract,
    error,
  } = useWriteContract({
    mutation: {
      onSuccess: () => {
        setTimeout(() => {
          refetch()
        }, 100)
      },
      onSettled: (data, settledError) => {
        console.log('Settled', { data, error: settledError })
      },
    },
  })

  async function submit({ amount }: { amount: string }) {
    if (!config?.address) return
    const amountWei = BigInt(amount) * BigInt(10 ** 18)
    if (config.type === 'claim') {
      writeContract({
        address: getAddress(config.address),
        abi: parseAbi(['function claim(uint256 amount)']),
        functionName: 'claim',
        args: [amountWei],
      })
    } else {
      writeContract({
        address: getAddress(config.address),
        abi: parseAbi(['function mint(address to, uint256 amount)']),
        functionName: 'mint',
        args: [address!, amountWei],
      })
    }
  }

  return (
    <div>
      <h2>Mint contract</h2>
      <p className="mb-2 text-zinc-400 text-sm">
        Current balance: {balance?.toString()} {(tokenSymbol as string) || ''}
      </p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const amount = (event.target as HTMLFormElement).amount.value
          submit({ amount })
        }}
      >
        <input
          type="number"
          placeholder="Enter amount to mint"
          className="grow peer"
          name="amount"
        />
        <button className="btn" disabled={isPending || !address || !config}>
          {isPending ? 'Minting...' : 'Mint Tokens'}
        </button>
      </form>
      <TruncateData data={hash} />
      <TruncateData data={error?.message} className="text-red-400" />
      <TruncateData data={balanceError?.message} className="text-red-400" />
    </div>
  )
}

export function ActionsCard() {
  return (
    <div className="flex flex-col w-full">
      <h1>Actions</h1>
      <span className="mb-4 text-zinc-400 text-sm">
        Interact with smart contracts on the blockchain.
      </span>
      <MintContract />
    </div>
  )
}
