import { ChainTypeEnum, embeddedWalletId, useOpenfort } from '@openfort/react'
import { useEthereumEmbeddedWallet } from '@openfort/react/ethereum'
import { useCallback, useState } from 'react'
import { type Abi, createPublicClient, encodeFunctionData, http } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'
import { DEFAULT_EVM_CHAIN, getPlaygroundRpcUrl } from '@/lib/chains'
import { toError } from '@/lib/errors'
import { useAsyncData } from './useAsyncData'

interface UseAccountLike {
  address?: `0x${string}`
  chainId?: number
  isConnected: boolean
}

interface UseReadContractLike {
  data?: unknown
  refetch: () => void
  error: Error | null
  isLoading: boolean
}

interface UseWriteContractLike {
  data?: `0x${string}`
  writeContract: (params: {
    address: `0x${string}`
    abi: unknown[]
    functionName: string
    args?: unknown[]
  }) => Promise<`0x${string}`>
  isPending: boolean
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  error?: Error | null
}

/**
 * EVM account from embedded wallet only. For evm mode use useConnectedEthereumAccount or wagmi's useAccount.
 */
export function useEthereumAccount(): UseAccountLike {
  const core = useOpenfort()
  const wallet = useEthereumEmbeddedWallet()

  const hookConnected = wallet.status === 'connected' && core.chainType === ChainTypeEnum.EVM && !!wallet.address
  if (hookConnected) {
    return {
      address: wallet.address as `0x${string}`,
      chainId: wallet.chainId,
      isConnected: true,
    }
  }

  const fallbackAddress = core.activeEmbeddedAddress
  const evmAccount =
    core.chainType === ChainTypeEnum.EVM &&
    fallbackAddress &&
    core.embeddedAccounts?.find(
      (a) => a.chainType === ChainTypeEnum.EVM && a.address.toLowerCase() === fallbackAddress.toLowerCase()
    )
  const useFallback = !!evmAccount
  const chainId = wallet.activeChainId ?? DEFAULT_EVM_CHAIN.id

  return {
    address: useFallback ? (evmAccount.address as `0x${string}`) : undefined,
    chainId: useFallback ? chainId : undefined,
    isConnected: useFallback,
  }
}

/**
 * Reads contract data (view function). Uses useAsyncData, no TanStack Query.
 */
export function useEthereumReadContractLocal(params: {
  address: `0x${string}`
  abi: Abi
  functionName: string
  args?: unknown[]
  chainId?: number
}): UseReadContractLike {
  const { chainId: connectedChainId } = useEthereumAccount()
  const chainId = params.chainId ?? connectedChainId
  const enabled = !!params.address && !!params.functionName && !!chainId

  const { data, error, isLoading, refetch } = useAsyncData({
    queryKey: ['readContract', params.address, params.functionName, params.args, chainId],
    queryFn: async () => {
      const rpcUrl = getPlaygroundRpcUrl(chainId)
      const client = createPublicClient({ transport: http(rpcUrl) })
      return client.readContract({
        address: params.address,
        abi: params.abi,
        functionName: params.functionName,
        args: params.args as readonly unknown[] | undefined,
      })
    },
    enabled,
  })

  return {
    data,
    refetch,
    error: error as Error | null,
    isLoading,
  }
}

type WriteParams = { address: `0x${string}`; abi: unknown[]; functionName: string; args?: unknown[] }

/**
 * Write contract using the active wallet provider.
 * Routes through wagmi wallet client for external wallets (MetaMask, etc.)
 * and through embedded wallet provider for Openfort embedded wallets.
 */
export function useEthereumWriteContractLocal(): UseWriteContractLike {
  const { address: wagmiAddress, isConnected, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const core = useOpenfort()
  const wallet = useEthereumEmbeddedWallet()

  const useExternalWallet = isConnected && !!connector && connector.id !== embeddedWalletId
  const address = useExternalWallet
    ? wagmiAddress
    : ((wallet.address as `0x${string}` | undefined) ?? (core.activeEmbeddedAddress as `0x${string}` | undefined))

  const [data, setData] = useState<`0x${string}` | undefined>(undefined)
  const [isPending, setIsPending] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const writeContract = useCallback(
    async (params: WriteParams) => {
      if (!address) {
        const err = new Error('Wallet not connected')
        setError(err)
        setIsError(true)
        return Promise.reject(err)
      }

      setIsPending(true)
      setIsError(false)
      setIsSuccess(false)
      setError(null)

      try {
        const dataEncoded = encodeFunctionData({
          abi: params.abi as Abi,
          functionName: params.functionName,
          args: params.args,
        })

        let txHash: `0x${string}`

        if (useExternalWallet) {
          if (!walletClient) {
            throw new Error('External wallet client is not ready. Please try again.')
          }
          txHash = await walletClient.sendTransaction({
            account: address,
            to: params.address,
            data: dataEncoded,
          })
        } else {
          const provider =
            wallet.status === 'connected' && wallet.activeWallet
              ? await wallet.activeWallet.getProvider()
              : await core.client.embeddedWallet.getEthereumProvider()

          txHash = (await provider.request({
            method: 'eth_sendTransaction',
            params: [{ from: address, to: params.address, data: dataEncoded }],
          })) as `0x${string}`
        }

        setData(txHash)
        setIsSuccess(true)
        return txHash
      } catch (err) {
        const e = toError(err)
        setError(e)
        setIsError(true)
        throw e
      } finally {
        setIsPending(false)
      }
    },
    [address, useExternalWallet, walletClient, wallet.status, wallet.activeWallet, core.client]
  )

  return {
    data,
    writeContract,
    isPending,
    isLoading: isPending,
    isError,
    isSuccess,
    error,
  }
}
