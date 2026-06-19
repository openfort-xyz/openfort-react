'use client'

/**
 * Solana Send confirmation page
 *
 * Reviews the SOL transfer from `sendForm`, optionally sponsors the fee through
 * the Openfort Solana paymaster (Kora), submits via `sendSol` / `sendSolGasless`,
 * and shows the signature + explorer link on success.
 */

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useState } from 'react'
import { getExplorerUrl } from '../../../shared/utils/explorer'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import { sendSol, sendSolGasless } from '../../../solana/transfer'
import { truncateSolanaAddress } from '../../../utils'
import Button from '../../Common/Button'
import { CopyText } from '../../Common/CopyToClipboard/CopyText'
import Loader from '../../Common/Loading'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import {
  AddressValue,
  AmountValue,
  ButtonRow,
  ErrorContainer,
  ErrorMessage,
  ErrorTitle,
  GaslessRow,
  GaslessToggle,
  SummaryItem,
  SummaryLabel,
  SummaryList,
} from './styles'

export const SolanaSendConfirmation = () => {
  const { sendForm, setRoute, publishableKey, triggerResize } = useOpenfort()
  const wallet = useSolanaEmbeddedWallet()

  const address = wallet.status === 'connected' ? wallet.address : undefined
  const provider = wallet.status === 'connected' ? wallet.provider : undefined
  const cluster = wallet.cluster ?? 'devnet'
  const rpcUrl = wallet.rpcUrl

  const recipient = sendForm.recipient
  const amount = sendForm.amount

  const [gasless, setGasless] = useState(false)
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
    const amountSol = Number(amount)
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      setError('Enter a valid amount.')
      return
    }
    if (!gasless && !rpcUrl) {
      setError('No Solana RPC is configured for this network.')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const sig = gasless
        ? await sendSolGasless({ from: address, to: recipient, amountSol, provider, cluster, publishableKey })
        : await sendSol({ from: address, to: recipient, amountSol, provider, rpcUrl: rpcUrl ?? '' })
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
        <Loader isSuccess header="Transfer sent" description={`${amount} SOL sent successfully`} />
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
      <ModalBody>Review the transaction details before sending.</ModalBody>

      <SummaryList>
        <SummaryItem>
          <SummaryLabel>Sending</SummaryLabel>
          <AmountValue>{amount || '0'} SOL</AmountValue>
        </SummaryItem>
        <SummaryItem>
          <SummaryLabel>From</SummaryLabel>
          <AddressValue>
            {address ? (
              <CopyText size="1rem" value={address}>
                {truncateSolanaAddress(address)}
              </CopyText>
            ) : (
              '--'
            )}
          </AddressValue>
        </SummaryItem>
        <SummaryItem>
          <SummaryLabel>To</SummaryLabel>
          <AddressValue>
            {recipient ? (
              <CopyText size="1rem" value={recipient}>
                {truncateSolanaAddress(recipient)}
              </CopyText>
            ) : (
              '--'
            )}
          </AddressValue>
        </SummaryItem>
      </SummaryList>

      <GaslessRow>
        <div>
          <SummaryLabel>Sponsor network fee</SummaryLabel>
          <div style={{ fontSize: 12, color: 'var(--ck-body-color-muted)', marginTop: 2 }}>
            Pay no SOL fee (requires a sponsorship policy)
          </div>
        </div>
        <GaslessToggle
          type="button"
          role="switch"
          aria-checked={gasless}
          aria-label="Sponsor network fee"
          $on={gasless}
          onClick={() => setGasless((v) => !v)}
          disabled={isLoading}
        >
          <span />
        </GaslessToggle>
      </GaslessRow>

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
