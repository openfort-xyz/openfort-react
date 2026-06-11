import type { Address } from 'viem'
import { createPublicClient, formatUnits, http } from 'viem'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { logger } from '../../../utils/logger'
import { getDefaultEthereumRpcUrl } from '../../../utils/rpc'
import Tooltip from '../../Common/Tooltip'
import { formatBalance } from '../Send/utils'
import { InfoIconWrapper } from './styles'

const InfoIcon = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M7 10V6.5M7 4.5H7.005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

type EstimatedFeesProps = {
  account: Address | undefined
  to: Address | undefined
  value: bigint | undefined
  data: `0x${string}` | undefined
  chainId: number | undefined
  nativeSymbol: string
  enabled?: boolean
  hideInfoIcon?: boolean
}

export const EstimatedFees = ({
  account,
  to,
  value,
  data,
  chainId,
  nativeSymbol,
  enabled = true,
  hideInfoIcon = false,
}: EstimatedFeesProps) => {
  const { data: assets } = useEthereumWalletAssets()
  const pricePerToken = assets?.find((a) => a.type === 'native')?.metadata?.fiat?.value as number | undefined

  const gas = useAsyncData({
    queryKey: ['gas-estimate', account, to, value, data, chainId],
    queryFn: async () => {
      if (!account || !to || !chainId) return null
      try {
        const rpcUrl = getDefaultEthereumRpcUrl(chainId)
        const publicClient = createPublicClient({ transport: http(rpcUrl) })
        const [gasEstimate, feesPerGas] = await Promise.all([
          publicClient.estimateGas({
            account,
            to,
            value: value ?? BigInt(0),
            data: data ?? '0x',
          }),
          publicClient.estimateFeesPerGas(),
        ])
        const estimatedCost = gasEstimate * (feesPerGas.maxFeePerGas ?? BigInt(0))
        return { estimatedCost, gasLimit: gasEstimate }
      } catch (error) {
        logger.error('Failed to estimate gas:', error)
        return null
      }
    },
    enabled: enabled && !!account && !!to && !!chainId,
  })

  // Handle query states
  if (!gas.data || gas.error) {
    return <>--</>
  }

  const gasCost = gas.data.estimatedCost
  const gasUnits = gas.data.gasLimit

  if (pricePerToken !== undefined) {
    const gasCostInEth = Number.parseFloat(formatUnits(gasCost, 18))
    const gasCostInUsd = gasCostInEth * pricePerToken

    return (
      <>
        ≈ {usdFormatter.format(gasCostInUsd)}
        {!hideInfoIcon && (
          <Tooltip message={`${gasUnits.toString()} gas units (paid in ${nativeSymbol})`} delay={0.2}>
            <InfoIconWrapper>
              <InfoIcon />
            </InfoIconWrapper>
          </Tooltip>
        )}
      </>
    )
  }

  // Fallback to native token if price not available
  return (
    <>
      ≈ {formatBalance(gasCost, 18)} {nativeSymbol}
      {!hideInfoIcon && (
        <Tooltip message={`${gasUnits.toString()} gas units`} delay={0.2}>
          <InfoIconWrapper>
            <InfoIcon />
          </InfoIconWrapper>
        </Tooltip>
      )}
    </>
  )
}
