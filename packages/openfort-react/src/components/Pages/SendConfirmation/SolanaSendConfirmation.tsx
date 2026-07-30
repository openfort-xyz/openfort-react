'use client'

/**
 * Solana Send confirmation page
 *
 * Reviews the transfer from `sendForm` (native SOL or an SPL token) and submits
 * it. Network fees are sponsored through the Openfort paymaster (Kora) when
 * `walletConfig.solana.sponsorFees` is set — mirroring the EVM
 * `ethereumFeeSponsorshipId` flow — otherwise the wallet pays. Shows the
 * signature + explorer link on success.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import { currencyLogoUrl } from '../../../constants/logos.js'
import { useAsyncData } from '../../../shared/hooks/useAsyncData.js'
import { getExplorerUrl } from '../../../shared/utils/explorer.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import {
  estimateSolanaTransferFeeLamports,
  sendSol,
  sendSolGasless,
  sendSplToken,
  sendSplTokenGasless,
} from '../../../solana/transfer.js'
import { truncateSolanaAddress } from '../../../utils/index.js'
import Button from '../../Common/Button/index.js'
import Loader from '../../Common/Loading/index.js'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { formatBalance, formatBalanceWithSymbol } from '../Send/utils.js'
import { ConfirmationSummary } from './ConfirmationSummary.js'
import { ButtonRow, ErrorContainer, ErrorMessage, ErrorTitle, FeeStrike, FeesValue, SponsoredText } from './styles.js'

const SOL_DECIMALS = 9

export const SolanaSendConfirmation = () => {
  const { sendForm, setRoute, publishableKey, triggerResize, walletConfig } = useOpenfort()
  const wallet = useSolanaEmbeddedWallet()

  const address = wallet.status === 'connected' ? wallet.address : undefined
  const provider = wallet.status === 'connected' ? wallet.provider : undefined
  const cluster = wallet.cluster ?? 'devnet'
  const rpcUrl = wallet.rpcUrl

  const recipient = sendForm.recipient
  const amount = sendForm.amount
  const asset = sendForm.asset
  const symbol = asset.type === 'spl' ? asset.metadata.symbol : 'SOL'
  const decimals = asset.type === 'spl' ? asset.metadata.decimals : SOL_DECIMALS

  // Fees are sponsored from config (the SVM counterpart of ethereumFeeSponsorshipId).
  const isSponsored = Boolean(walletConfig?.solana?.sponsorFees)

  // Real network fee from the RPC (getFeeForMessage). Null while loading or on failure.
  const feeQuery = useAsyncData({
    queryKey: ['sol-fee', address, recipient, rpcUrl],
    queryFn: () =>
      address && recipient && rpcUrl
        ? estimateSolanaTransferFeeLamports({ from: address, to: recipient, rpcUrl })
        : Promise.resolve(null),
    enabled: Boolean(address && recipient && rpcUrl),
  })
  const feeText = feeQuery.data != null ? `≈ ${formatBalance(feeQuery.data, SOL_DECIMALS)} SOL` : null

  const [isLoading, setIsLoading] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Re-measure the modal when the result/error appears.
  useEffect(() => {
    const id = setTimeout(triggerResize, 10)
    return () => clearTimeout(id)
  }, [signature, error, isLoading, triggerResize])

  const handleConfirm = async () => {
    if (!address || !provider || isLoading) return
    // The Send screen validates these before navigating here; re-guard in case
    // this page is reached directly with an unvalidated form.
    if (!recipient.trim()) {
      setError('Enter a recipient address.')
      return
    }
    const amountNum = Number(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (!isSponsored && !rpcUrl) {
      setError('No Solana RPC is configured for this network.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      let sig: string
      if (asset.type === 'spl') {
        const baseUnits = parseUnits(amount, decimals)
        sig = isSponsored
          ? await sendSplTokenGasless({
              from: address,
              to: recipient,
              mint: asset.address,
              amount: baseUnits,
              provider,
              cluster,
              publishableKey,
            })
          : await sendSplToken({
              from: address,
              to: recipient,
              mint: asset.address,
              amount: baseUnits,
              decimals,
              provider,
              rpcUrl: rpcUrl ?? '',
            })
      } else {
        sig = isSponsored
          ? await sendSolGasless({
              from: address,
              to: recipient,
              amountSol: amountNum,
              provider,
              cluster,
              publishableKey,
            })
          : await sendSol({ from: address, to: recipient, amountSol: amountNum, provider, rpcUrl: rpcUrl ?? '' })
      }
      setSignature(sig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinish = () => setRoute(routes.SOL_CONNECTED)
  const handleViewExplorer = () => {
    if (!signature) return
    window.open(getExplorerUrl(ChainTypeEnum.SVM, { txHash: signature, cluster }), '_blank', 'noopener,noreferrer')
  }

  if (signature) {
    return (
      <PageContent>
        <Loader isSuccess header="Transfer sent" description={`${amount} ${symbol} sent successfully`} />
        <ButtonRow>
          <Button variant="primary" onClick={handleViewExplorer}>
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
    <PageContent onBack={routes.SOL_SEND}>
      <ModalHeading>Confirm transfer</ModalHeading>
      <ModalBody>Review the transaction before sending.</ModalBody>

      <ConfirmationSummary
        amount={amount || '0'}
        symbol={symbol}
        to={recipient ? { display: truncateSolanaAddress(recipient), value: recipient } : undefined}
        networkName={`Solana ${cluster.charAt(0).toUpperCase()}${cluster.slice(1)}`}
        networkIcon={currencyLogoUrl('SOL') ? <img src={currencyLogoUrl('SOL') ?? ''} alt="" /> : undefined}
        balance={formatBalanceWithSymbol(asset.balance, decimals, symbol)}
        payWith={address ? { display: truncateSolanaAddress(address), value: address } : undefined}
        fee={
          <FeesValue>
            {isSponsored ? (
              <>
                {feeText && <FeeStrike>{feeText}</FeeStrike>} <SponsoredText>Sponsored</SponsoredText>
              </>
            ) : (
              (feeText ?? '--')
            )}
          </FeesValue>
        }
      />

      {error && (
        <ErrorContainer>
          <ErrorTitle>Transaction failed</ErrorTitle>
          <ErrorMessage>{error}</ErrorMessage>
        </ErrorContainer>
      )}

      <ButtonRow>
        <Button variant="primary" onClick={handleConfirm} disabled={!address || isLoading} waiting={isLoading}>
          {isLoading ? 'Confirming...' : 'Confirm'}
        </Button>
        <Button variant="secondary" onClick={() => setRoute(routes.SOL_SEND)} disabled={isLoading}>
          Cancel
        </Button>
      </ButtonRow>
    </PageContent>
  )
}
