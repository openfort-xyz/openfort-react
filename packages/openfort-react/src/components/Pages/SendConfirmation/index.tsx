'use client'

/**
 * SendConfirmation Page
 *
 * Wagmi-free transaction confirmation page.
 * Uses viem direct calls + useQuery for balance, transactions, and receipts.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Abi, Address } from 'viem'
import { createPublicClient, encodeFunctionData, erc20Abi, http, isAddress, parseUnits } from 'viem'
import { TickIcon } from '../../../assets/icons'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets'
import { useBalance } from '../../../hooks/useBalance'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useAsyncData } from '../../../shared/hooks/useAsyncData'
import { getExplorerUrl } from '../../../shared/utils/explorer'
import { truncateEthAddress } from '../../../utils'
import { parseTransactionError } from '../../../utils/errorHandling'
import { logger } from '../../../utils/logger'
import { getChainName, getDefaultEthereumRpcUrl } from '../../../utils/rpc'
import Button from '../../Common/Button'
import { CopyText } from '../../Common/CopyToClipboard/CopyText'
import Loader from '../../Common/Loading'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { getAssetDecimals, getAssetSymbol, isSameToken, sanitizeForParsing } from '../Send/utils'
import { EstimatedFees } from './EstimatedFees'
import {
  AddressValue,
  AmountValue,
  ButtonRow,
  CheckIconWrapper,
  ErrorAction,
  ErrorContainer,
  ErrorMessage,
  ErrorTitle,
  FeesValue,
  StatusMessage,
  SummaryItem,
  SummaryLabel,
  SummaryList,
} from './styles'

/** Check if chain is a testnet */
function isTestnetChain(chainId: number): boolean {
  const testnets = new Set([5, 11155111, 80001, 84532, 421614, 97, 4002])
  return testnets.has(chainId)
}

const SendConfirmation = () => {
  const wallet = useEthereumEmbeddedWallet()
  const { chainType } = useOpenfortCore()
  const { sendForm, setRoute, triggerResize, walletConfig } = useOpenfort()

  const address = wallet.status === 'connected' ? (wallet.address as `0x${string}`) : undefined
  const chainId = wallet.status === 'connected' ? wallet.chainId : undefined

  // Build chain info for block explorer
  const chain = chainId
    ? {
        id: chainId,
        name: getChainName(chainId),
        blockExplorers: {
          default: {
            url: getExplorerUrl(ChainTypeEnum.EVM, { chainId }),
          },
        },
        testnet: isTestnetChain(chainId),
      }
    : undefined

  const recipientAddress = isAddress(sendForm.recipient) ? (sendForm.recipient as Address) : undefined
  const normalisedAmount = sanitizeForParsing(sendForm.amount)

  const { data: assets } = useEthereumWalletAssets()
  const matchedToken = useMemo(
    () => assets?.find((asset) => isSameToken(asset, sendForm.asset)),
    [assets, sendForm.asset]
  )

  const selectedTokenOption = matchedToken ?? assets?.[0]
  const token = selectedTokenOption ?? sendForm.asset

  const isErc20 = token.type === 'erc20'

  const nativeBalance = useBalance({
    address: address ?? '',
    chainType: chainType,
    chainId: chainId ?? 84532,
    cluster: chainType === ChainTypeEnum.SVM ? 'devnet' : undefined,
    enabled: !!address && !isErc20,
  })

  const refetchNativeBalance = nativeBalance.refetch

  // ERC20 balance using viem publicClient directly (skipped when native send; no placeholder address)
  const erc20Balance = useAsyncData({
    queryKey: ['erc20-balance', address, token.type === 'erc20' ? token.address : null, chainId],
    queryFn: async () => {
      if (!isErc20 || !address || !chainId) return { value: BigInt(0), decimals: 18, symbol: 'ERC20' }
      try {
        const rpcUrl = getDefaultEthereumRpcUrl(chainId)
        const publicClient = createPublicClient({ transport: http(rpcUrl) })
        const balance = await publicClient.readContract({
          address: token.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        })
        return { value: balance as bigint, decimals: 18, symbol: getAssetSymbol(token) }
      } catch (error) {
        logger.error('Failed to fetch ERC20 balance:', error)
        return { value: BigInt(0), decimals: 18, symbol: getAssetSymbol(token) }
      }
    },
    enabled: Boolean(isErc20 && address && chainId),
  })

  const refetchErc20Balance = erc20Balance.refetch

  const parsedAmount =
    normalisedAmount && token && getAssetDecimals(token) !== undefined
      ? (() => {
          try {
            return parseUnits(normalisedAmount, getAssetDecimals(token))
          } catch (_error) {
            return null
          }
        })()
      : null

  useEffect(() => {
    if (!recipientAddress || parsedAmount === null || parsedAmount <= BigInt(0)) {
      logger.log('INVALID - recipientAddress:', recipientAddress, 'parsedAmount:', parsedAmount)
      // setRoute(routes.SEND)
    }
  }, [recipientAddress, parsedAmount, setRoute])

  // Get current balance value from discriminated unions
  const nativeBalanceValue = nativeBalance.status === 'success' ? nativeBalance.value : undefined
  const erc20BalanceValue = erc20Balance.data && !erc20Balance.error ? erc20Balance.data?.value : undefined
  const currentBalance = isErc20 ? erc20BalanceValue : nativeBalanceValue
  const nativeSymbol = nativeBalance.status === 'success' ? nativeBalance.symbol : 'ETH'

  const insufficientBalance =
    parsedAmount !== null && currentBalance !== undefined ? parsedAmount > currentBalance : false

  // Track original balance and polling state
  const [isPollingBalance, setIsPollingBalance] = useState(false)
  const originalBalanceRef = useRef<bigint | undefined>(undefined)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const submittingRef = useRef(false)

  // Inline transaction state management (replaces useEthereumSendTransaction + useEthereumWriteContract)
  const [nativeTxHash, setNativeTxHash] = useState<`0x${string}` | undefined>(undefined)
  const [isNativePending, setIsNativePending] = useState(false)
  const [nativeError, setNativeError] = useState<Error | null>(null)

  const [erc20TxHash, setErc20TxHash] = useState<`0x${string}` | undefined>(undefined)
  const [isTokenPending, setIsTokenPending] = useState(false)
  const [erc20Error, setErc20Error] = useState<Error | null>(null)

  const transactionHash = nativeTxHash ?? erc20TxHash

  const sendTransactionAsync = async (params: { to: `0x${string}`; value: bigint; chainId?: number }) => {
    setIsNativePending(true)
    setNativeError(null)
    try {
      if (!wallet.activeWallet) throw new Error('Wallet not available')
      const provider = await wallet.activeWallet.getProvider()
      const hash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: params.to,
            value: `0x${params.value.toString(16)}`,
          },
        ],
      })) as `0x${string}`
      setNativeTxHash(hash)
      return hash
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      setNativeError(err)
      throw err
    } finally {
      setIsNativePending(false)
    }
  }

  const writeContractAsync = async (params: {
    abi: Abi | readonly unknown[]
    address: `0x${string}`
    functionName: string
    args: unknown[]
    chainId?: number
  }) => {
    setIsTokenPending(true)
    setErc20Error(null)
    try {
      if (!wallet.activeWallet) throw new Error('Wallet not available')
      const provider = await wallet.activeWallet.getProvider()
      const data = encodeFunctionData({
        abi: params.abi as Abi,
        functionName: params.functionName,
        args: params.args,
      })
      const hash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from: address, to: params.address, data }],
      })) as `0x${string}`
      setErc20TxHash(hash)
      return hash
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      setErc20Error(err)
      throw err
    } finally {
      setIsTokenPending(false)
    }
  }

  const transferData =
    recipientAddress && parsedAmount !== null && parsedAmount > BigInt(0)
      ? token.type === 'erc20'
        ? encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [recipientAddress, parsedAmount],
          })
        : undefined
      : undefined

  // Wait for transaction receipt using viem publicClient directly
  const receiptState = useAsyncData({
    queryKey: ['tx-receipt', transactionHash, chainId],
    queryFn: async () => {
      if (!transactionHash || !chainId) return null
      try {
        const rpcUrl = getDefaultEthereumRpcUrl(chainId)
        const publicClient = createPublicClient({ transport: http(rpcUrl) })
        const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash })
        return receipt
      } catch (error) {
        logger.error('Failed to get transaction receipt:', error)
        throw error
      }
    },
    enabled: Boolean(transactionHash && chainId),
  })

  const receipt = receiptState.data
  const isWaitingForReceipt = receiptState.isLoading
  const isSuccess = receiptState.data && !receiptState.error && receiptState.data?.status === 'success'
  const waitError = receiptState.error ?? null

  const isSubmitting = isNativePending || isTokenPending
  const isLoading = isSubmitting || isWaitingForReceipt

  const firstError = nativeError || erc20Error || waitError

  // Store original balance when transaction starts
  useEffect(() => {
    if (isSubmitting && originalBalanceRef.current === undefined) {
      originalBalanceRef.current = currentBalance
    }
  }, [isSubmitting, currentBalance])

  // Poll balance when transaction is successful until it changes
  useEffect(() => {
    if (isSuccess && originalBalanceRef.current !== undefined) {
      // Start polling
      setIsPollingBalance(true)

      const refetchBalance = isErc20 ? refetchErc20Balance : refetchNativeBalance

      // Immediate first refetch
      refetchBalance()

      // Set up interval for polling every 3 seconds
      pollingIntervalRef.current = setInterval(() => {
        refetchBalance()
      }, 3000)
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [isSuccess, isErc20, refetchErc20Balance, refetchNativeBalance])

  // Stop polling when balance changes
  useEffect(() => {
    if (isPollingBalance && currentBalance !== undefined && originalBalanceRef.current !== undefined) {
      if (currentBalance !== originalBalanceRef.current) {
        setIsPollingBalance(false)
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }
  }, [isPollingBalance, currentBalance])

  const handleConfirm = async () => {
    if (submittingRef.current) return
    if (!recipientAddress || !parsedAmount || parsedAmount <= BigInt(0) || insufficientBalance) return

    submittingRef.current = true
    try {
      if (token.type === 'native') {
        await sendTransactionAsync({
          to: recipientAddress,
          value: parsedAmount,
          chainId,
        })
      } else {
        await writeContractAsync({
          abi: erc20Abi,
          address: token.address as `0x${string}`,
          functionName: 'transfer',
          args: [recipientAddress, parsedAmount],
          chainId,
        })
      }
    } catch (_error) {
      // Errors are surfaced through mutation hooks
    } finally {
      submittingRef.current = false
    }
  }

  const handleCancel = () => {
    // Keep the current token, amount, and recipient when going back - don't reset
    setRoute(routes.SEND)
  }

  const handleFinish = () => {
    // Clear polling interval if still running
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPollingBalance(false)

    // Don't reset the form - keep amount, token, and recipient for easier repeat transactions
    setRoute(routes.CONNECTED)
  }

  const status: 'idle' | 'success' | 'error' = isSuccess ? 'success' : firstError ? 'error' : 'idle'
  const errorDetails = status === 'error' ? parseTransactionError(firstError) : null

  const blockExplorerUrl = chain?.blockExplorers?.default?.url

  const handleOpenBlockExplorer = () => {
    if (receipt?.transactionHash && blockExplorerUrl) {
      window.open(`${blockExplorerUrl}/tx/${receipt.transactionHash}`, '_blank', 'noopener,noreferrer')
    }
  }

  useEffect(() => {
    setTimeout(triggerResize, 10) // delay required here for modal to resize
  }, [errorDetails, insufficientBalance, receipt?.transactionHash, isLoading, triggerResize])

  const isSponsored = useMemo(() => {
    const feeSponsorship = walletConfig?.ethereum?.ethereumFeeSponsorshipId
    if (!feeSponsorship) return false
    if (typeof feeSponsorship === 'string') return true
    return feeSponsorship[chainId ?? 0] !== undefined
  }, [walletConfig?.ethereum?.ethereumFeeSponsorshipId, chainId])

  if (isSuccess) {
    const successAmount = normalisedAmount || '0'
    const successSymbol = getAssetSymbol(token)
    return (
      <PageContent>
        <Loader isSuccess header="Transfer Sent" description={`${successAmount} ${successSymbol} sent successfully`} />
        <ButtonRow>
          <Button variant="primary" onClick={handleOpenBlockExplorer}>
            View on Explorer
          </Button>
          <Button variant="secondary" onClick={handleFinish}>
            Back to profile
          </Button>
        </ButtonRow>
      </PageContent>
    )
  }

  return (
    <PageContent>
      <ModalHeading>Confirm transfer</ModalHeading>
      <ModalBody>Review the transaction details before sending.</ModalBody>

      <SummaryList>
        <SummaryItem>
          <SummaryLabel>Sending</SummaryLabel>
          <AmountValue>
            {normalisedAmount || '0'} {getAssetSymbol(token)}
          </AmountValue>
        </SummaryItem>

        <SummaryItem>
          <SummaryLabel>From</SummaryLabel>
          <AddressValue>
            {address ? (
              <CopyText size="1rem" value={address}>
                {truncateEthAddress(address)}
              </CopyText>
            ) : (
              '--'
            )}
          </AddressValue>
        </SummaryItem>

        <SummaryItem>
          <SummaryLabel>To</SummaryLabel>
          <AddressValue>
            {recipientAddress ? (
              <CopyText size="1rem" value={recipientAddress}>
                {truncateEthAddress(recipientAddress)}
              </CopyText>
            ) : (
              '--'
            )}
          </AddressValue>
        </SummaryItem>

        <div>
          <SummaryItem>
            <SummaryLabel>Estimated fees</SummaryLabel>
            <FeesValue $completed={isSponsored}>
              <EstimatedFees
                account={address}
                to={token.type === 'erc20' ? (token.address as `0x${string}`) : recipientAddress}
                value={token.type === 'native' && parsedAmount ? parsedAmount : undefined}
                data={transferData}
                chainId={chainId}
                nativeSymbol={nativeSymbol}
                enabled={Boolean(address && recipientAddress && parsedAmount && parsedAmount > BigInt(0))}
                hideInfoIcon={isSponsored}
              />
              <CheckIconWrapper>
                <TickIcon />
              </CheckIconWrapper>
            </FeesValue>
          </SummaryItem>
          {isSponsored && (
            <div
              style={{
                textAlign: 'end',
                marginTop: '4px',
                width: '100%',
                color: 'var(--ck-body-color-valid)',
                fontSize: '12px',
              }}
            >
              Sponsored transaction
            </div>
          )}
        </div>
      </SummaryList>

      {insufficientBalance && !isSuccess && (
        <StatusMessage $status="error">Insufficient balance for this transfer.</StatusMessage>
      )}

      {errorDetails && (
        <ErrorContainer>
          <ErrorTitle>{errorDetails.title}</ErrorTitle>
          <ErrorMessage>{errorDetails.message}</ErrorMessage>
          {errorDetails.action && <ErrorAction>{errorDetails.action}</ErrorAction>}
        </ErrorContainer>
      )}

      <ButtonRow>
        <Button
          variant="primary"
          onClick={isSuccess ? handleOpenBlockExplorer : handleConfirm}
          disabled={
            isSuccess ? false : !recipientAddress || !parsedAmount || parsedAmount <= BigInt(0) || insufficientBalance
          }
          waiting={isLoading}
          icon={isSuccess ? <TickIcon style={{ width: 18, height: 18 }} /> : undefined}
        >
          {isSuccess ? 'Confirmed' : isLoading ? 'Confirming...' : 'Confirm'}
        </Button>
        {isSuccess ? (
          <Button variant="secondary" onClick={handleFinish}>
            Back to profile
          </Button>
        ) : (
          <Button variant="secondary" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
      </ButtonRow>
    </PageContent>
  )
}

export default SendConfirmation
