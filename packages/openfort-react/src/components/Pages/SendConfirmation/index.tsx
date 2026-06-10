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

/**
 * Defensive timeout for `provider.request` calls. The underlying SDK's
 * `iframeManager.sign` already enforces a 90s timeout, so this 120s upper
 * bound exists to make sure the SDK's typed timeout wins on the wire —
 * if the React layer fired first we'd surface a generic "timeout" instead
 * of the SDK's `IframeSignTimeoutError`. The gap also covers RPC submission
 * after the signature is produced.
 */
const PROVIDER_REQUEST_TIMEOUT_MS = 120_000

/**
 * sessionStorage key for the in-flight send context. Persisting this
 * survives an F5 mid-confirmation, so the user does not re-click Confirm
 * and create a second `TransactionIntent` on the server.
 */
const SEND_CONFIRMATION_STORAGE_KEY = 'openfort:send-confirmation:tx'
const SEND_CONFIRMATION_STORAGE_TTL_MS = 30 * 60 * 1000

type StoredSendTx = {
  fromAddress: string
  chainId: number
  recipient: string
  amount: string
  tokenKey: string
  nativeTxHash?: `0x${string}`
  erc20TxHash?: `0x${string}`
  timestamp: number
}

function readStoredSendTx(): StoredSendTx | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null
  try {
    const raw = window.sessionStorage.getItem(SEND_CONFIRMATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSendTx
    if (Date.now() - parsed.timestamp > SEND_CONFIRMATION_STORAGE_TTL_MS) {
      window.sessionStorage.removeItem(SEND_CONFIRMATION_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredSendTx(entry: StoredSendTx): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.setItem(SEND_CONFIRMATION_STORAGE_KEY, JSON.stringify(entry))
  } catch {
    // sessionStorage may be unavailable (private mode, quota) — non-fatal.
  }
}

function clearStoredSendTx(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  try {
    window.sessionStorage.removeItem(SEND_CONFIRMATION_STORAGE_KEY)
  } catch {
    // ignore
  }
}

async function withProviderTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        handle = setTimeout(() => {
          reject(
            new Error(
              `Wallet did not respond within ${Math.round(timeoutMs / 1000)}s. The signing prompt may have been dismissed or the wallet is unresponsive.`
            )
          )
        }, timeoutMs)
      }),
    ])
  } finally {
    if (handle !== undefined) clearTimeout(handle)
  }
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

  // Captures anything thrown out of `handleConfirm` that wasn't already
  // surfaced via `nativeError`/`erc20Error` (defense in depth — see the
  // comment in `handleConfirm` for the failure mode this guards against).
  const [submitError, setSubmitError] = useState<Error | null>(null)

  const transactionHash = nativeTxHash ?? erc20TxHash

  // Stable key identifying the current send context. Used as the
  // sessionStorage matching key so a rehydrated tx hash is only restored
  // when the user lands back on the exact same recipient + amount + token
  // + chain after an F5.
  const tokenKey = token.type === 'native' ? `native:${chainId ?? 0}` : `erc20:${token.address.toLowerCase()}`

  // ----- F5-safe persistence of the in-flight tx hash -----
  // Without this, a refresh during receipt-waiting wipes the state and the
  // user is forced to click Confirm again, creating a SECOND
  // TransactionIntent on the server (the duplicated-intent symptom). We
  // persist the hash + a context fingerprint so rehydration only fires for
  // the same send.
  const rehydratedRef = useRef(false)
  useEffect(() => {
    if (rehydratedRef.current) return
    if (!address || !chainId || !recipientAddress || !normalisedAmount) return
    const stored = readStoredSendTx()
    if (!stored) return
    if (
      stored.fromAddress.toLowerCase() === address.toLowerCase() &&
      stored.chainId === chainId &&
      stored.recipient.toLowerCase() === recipientAddress.toLowerCase() &&
      stored.amount === normalisedAmount &&
      stored.tokenKey === tokenKey
    ) {
      if (stored.nativeTxHash) setNativeTxHash(stored.nativeTxHash)
      if (stored.erc20TxHash) setErc20TxHash(stored.erc20TxHash)
    }
    rehydratedRef.current = true
  }, [address, chainId, recipientAddress, normalisedAmount, tokenKey])

  useEffect(() => {
    if (!address || !chainId || !recipientAddress || !normalisedAmount) return
    if (!nativeTxHash && !erc20TxHash) return
    writeStoredSendTx({
      fromAddress: address,
      chainId,
      recipient: recipientAddress,
      amount: normalisedAmount,
      tokenKey,
      nativeTxHash,
      erc20TxHash,
      timestamp: Date.now(),
    })
  }, [address, chainId, recipientAddress, normalisedAmount, tokenKey, nativeTxHash, erc20TxHash])

  const sendTransactionAsync = async (params: { to: `0x${string}`; value: bigint; chainId?: number }) => {
    setIsNativePending(true)
    setNativeError(null)
    try {
      if (!wallet.activeWallet) throw new Error('Wallet not available')
      const provider = await wallet.activeWallet.getProvider()
      // Defensive timeout: if the SDK / signer iframe hangs, our `finally`
      // block (which clears the pending flag) would otherwise never run,
      // and the spinner would spin forever.
      const hash = (await withProviderTimeout(
        provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: address,
              to: params.to,
              value: `0x${params.value.toString(16)}`,
            },
          ],
        }),
        PROVIDER_REQUEST_TIMEOUT_MS
      )) as `0x${string}`
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
      // Defensive timeout: see `sendTransactionAsync` above for rationale.
      const hash = (await withProviderTimeout(
        provider.request({
          method: 'eth_sendTransaction',
          params: [{ from: address, to: params.address, data }],
        }),
        PROVIDER_REQUEST_TIMEOUT_MS
      )) as `0x${string}`
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

  const firstError = nativeError || erc20Error || waitError || submitError

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

  // Once the receipt is confirmed, drop the persisted entry — there is no
  // longer any duplicate-intent risk and we don't want a stale entry to
  // leak into the next confirmation flow.
  useEffect(() => {
    if (isSuccess) {
      clearStoredSendTx()
    }
  }, [isSuccess])

  const handleConfirm = async () => {
    if (submittingRef.current) return
    if (!recipientAddress || !parsedAmount || parsedAmount <= BigInt(0) || insufficientBalance) return

    submittingRef.current = true
    setSubmitError(null)
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
    } catch (error) {
      // `sendTransactionAsync` / `writeContractAsync` already wire the
      // error into `nativeError` / `erc20Error` before re-throwing, but we
      // also stash it here so any path that bypasses those setters (e.g. a
      // pre-flight throw before the inner try) still surfaces in the UI
      // instead of being silently swallowed. The previous handler caught
      // the error with an `_error` placeholder and a comment claiming it
      // was "surfaced through mutation hooks" — there are no mutation
      // hooks in this component, so a slip in the inner setters would have
      // left the spinner running forever.
      const err = error instanceof Error ? error : new Error(String(error))
      setSubmitError(err)
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
    // Finished — drop the persisted in-flight tx context so the next send
    // starts clean.
    clearStoredSendTx()

    // Don't reset the form - keep amount, token, and recipient for easier repeat transactions
    setRoute(routes.CONNECTED)
  }

  // Reset error state for a retry attempt. Used by the error UI's Retry
  // action so the user can re-trigger Confirm without leaving the page.
  const handleRetry = () => {
    setNativeError(null)
    setErc20Error(null)
    setSubmitError(null)
    setNativeTxHash(undefined)
    setErc20TxHash(undefined)
    clearStoredSendTx()
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
          onClick={
            isSuccess
              ? handleOpenBlockExplorer
              : errorDetails
                ? () => {
                    handleRetry()
                    void handleConfirm()
                  }
                : handleConfirm
          }
          disabled={
            isSuccess ? false : !recipientAddress || !parsedAmount || parsedAmount <= BigInt(0) || insufficientBalance
          }
          waiting={isLoading}
          icon={isSuccess ? <TickIcon style={{ width: 18, height: 18 }} /> : undefined}
        >
          {isSuccess ? 'Confirmed' : isLoading ? 'Confirming...' : errorDetails ? 'Try again' : 'Confirm'}
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
