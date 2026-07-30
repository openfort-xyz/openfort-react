import type { Address } from 'viem'
import { createPublicClient, formatUnits, http } from 'viem'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets.js'
import { useAsyncData } from '../../../shared/hooks/useAsyncData.js'
import { logger } from '../../../utils/logger.js'
import { getDefaultEthereumRpcUrl } from '../../../utils/rpc.js'
import Tooltip from '../../Common/Tooltip/index.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { formatBalance } from '../Send/utils.js'
import { FeeStrike, InfoIconWrapper, SponsoredText } from './styles.js'

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
  /** When fees are sponsored, show the estimate struck through next to "Sponsored". */
  sponsored?: boolean
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
  sponsored = false,
}: EstimatedFeesProps) => {
  const { walletConfig } = useOpenfort()
  const { data: assets } = useEthereumWalletAssets()
  const pricePerToken = assets?.find((a) => a.type === 'native')?.metadata?.fiat?.value as number | undefined

  const gas = useAsyncData({
    queryKey: ['gas-estimate', account, to, value, data, chainId],
    queryFn: async () => {
      if (!account || !to || !chainId) return null
      try {
        const rpcUrl = walletConfig?.ethereum?.rpcUrls?.[chainId] ?? getDefaultEthereumRpcUrl(chainId)
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

  // Format the estimate (USD when a native price is known, otherwise native units).
  const gasUnits = gas.data?.gasLimit
  let feeText: string | null = null
  if (gas.data && !gas.error) {
    const gasCost = gas.data.estimatedCost
    if (pricePerToken !== undefined) {
      feeText = `≈ ${usdFormatter.format(Number.parseFloat(formatUnits(gasCost, 18)) * pricePerToken)}`
    } else {
      feeText = `≈ ${formatBalance(gasCost, 18)} ${nativeSymbol}`
    }
  }

  const info =
    !hideInfoIcon && gasUnits ? (
      <Tooltip message={`${gasUnits.toString()} gas units (paid in ${nativeSymbol})`} delay={0.2}>
        <InfoIconWrapper>
          <InfoIcon />
        </InfoIconWrapper>
      </Tooltip>
    ) : null

  // Sponsored: show what it would have cost, struck through, next to "Sponsored".
  if (sponsored) {
    return (
      <>
        {feeText && <FeeStrike>{feeText}</FeeStrike>}
        <SponsoredText>Sponsored</SponsoredText>
      </>
    )
  }

  if (!feeText) return <>--</>

  return (
    <>
      {feeText}
      {info}
    </>
  )
}
