import { useMemo } from 'react'
import { getAddress, parseAbi } from 'viem'
import {
  useAccount,
  useChainId,
  useChains,
  useReadContract,
  useWriteContract
} from 'wagmi'
import { getMintContractConfig } from '../../lib/contracts'
import { TruncateData } from '../ui/TruncateData'

const MintContract = () => {
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
      onSettled: (data: unknown, error: Error | null) => {
        console.log('Settled', { data, error })
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
        onSubmit={(e) => {
          e.preventDefault()
          const amount = (e.target as HTMLFormElement).amount.value
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

export const Actions = () => {
  const hasFeeSponsorship = useMemo(() => !!import.meta.env.VITE_FEE_SPONSORSHIP_ID, [])
  const chains = useChains()
  return (
    <div className="flex flex-col w-full">
      <h1>Actions</h1>
      <span className="mb-4 text-zinc-400 text-sm">
        Interact with smart contracts on the blockchain.
      </span>
      {!hasFeeSponsorship && (
        <div className="mb-3 p-3 bg-red-800 text-white rounded text-sm">
          <strong>Warning: Transactions are not sponsored.</strong> Minting may
          fail because transactions are not being sponsored. To sponsor
          transactions, go to the{' '}
          <a
            href="https://dashboard.openfort.xyz/policies"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Openfort Dashboard
          </a>{' '}
          and <b>create a fee sponsorship</b> for transactions in{' '}
          <b>{chains[0].name}</b>. Set the <code>VITE_FEE_SPONSORSHIP_ID</code>{' '}
          environment variable with the fee sponsorship ID.
        </div>
      )}
      <MintContract />
    </div>
  )
}
