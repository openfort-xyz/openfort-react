'use client'

/**
 * Solana Send page
 *
 * Native SOL + SPL token transfer form with a token picker. Mirrors EthereumSend's
 * validation/Max behaviour; the actual transfer happens on the
 * SolanaSendConfirmation page.
 */

import { useMemo } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useSolanaWalletAssets } from '../../../solana/hooks/useSolanaWalletAssets'
import Button from '../../Common/Button'
import { Arrow, ArrowChevron } from '../../Common/Button/styles'
import Input from '../../Common/Input'
import { ModalHeading } from '../../Common/Modal/styles'
import { type Asset, routes, type SendFormState } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import {
  AmountInputWrapper,
  ErrorText,
  Field,
  FieldLabel,
  Form,
  HelperText,
  MaxButton,
  TokenSelectorButton,
  TokenSelectorContent,
  TokenSelectorRight,
  TokenSelectorValue,
} from './styles'
import { formatBalance, sanitizeAmountInput, sanitizeForParsing } from './utils'

const SOL_DECIMALS = 9

/** Cheap base58 shape check for the form; the RPC validates the real address on send. */
function isLikelySolanaAddress(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
}

/** A native SOL asset with the canonical metadata (the default form asset has none). */
function solAsset(balance: bigint): Asset {
  return {
    type: 'native',
    balance,
    metadata: { symbol: 'SOL', decimals: SOL_DECIMALS, fiat: { value: 0, currency: 'USD' } },
  }
}

export const SolanaSend = () => {
  const { sendForm, setSendForm, setRoute } = useOpenfort()
  const { data: assets } = useSolanaWalletAssets()

  const asset = sendForm.asset
  const selected =
    asset.type === 'spl'
      ? { isSpl: true as const, mint: asset.address, decimals: asset.metadata.decimals, symbol: asset.metadata.symbol }
      : { isSpl: false as const, mint: 'native', decimals: SOL_DECIMALS, symbol: 'SOL' }

  // Live balance (base units) for the selected token, matched by mint.
  const liveToken = assets?.find((t) => (selected.isSpl ? t.mint === selected.mint : t.isNative))
  const balanceBase = liveToken?.amount

  const parsedAmount = useMemo(() => {
    const raw = sanitizeForParsing(sendForm.amount)
    if (!raw) return null
    try {
      return parseUnits(raw, selected.decimals)
    } catch {
      return null
    }
  }, [sendForm.amount, selected.decimals])

  const recipientValid = isLikelySolanaAddress(sendForm.recipient.trim())
  const insufficientBalance = parsedAmount !== null && balanceBase !== undefined ? parsedAmount > balanceBase : false
  const amountValid = parsedAmount !== null && parsedAmount > BigInt(0) && !insufficientBalance
  const canProceed = recipientValid && amountValid

  const availableLabel = formatBalance(balanceBase, selected.decimals)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canProceed) return
    const normalized = sanitizeForParsing(sendForm.amount)
    if (!normalized) return
    // Persist the selected token with its live balance so the confirmation reads it.
    const nextAsset: Asset =
      asset.type === 'spl'
        ? { type: 'spl', address: asset.address, balance: balanceBase ?? asset.balance, metadata: asset.metadata }
        : solAsset(balanceBase ?? BigInt(0))
    setSendForm((prev: SendFormState) => ({
      ...prev,
      recipient: prev.recipient.trim(),
      amount: normalized,
      asset: nextAsset,
    }))
    setRoute(routes.SOL_SEND_CONFIRMATION)
  }

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = sanitizeAmountInput(event.target.value)
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setSendForm((prev) => ({ ...prev, amount: raw }))
    }
  }

  const handleMax = () => {
    if (balanceBase === undefined) return
    setSendForm((prev) => ({ ...prev, amount: formatUnits(balanceBase, selected.decimals) }))
  }

  const handleOpenTokenSelector = () => setRoute(routes.SOL_SEND_TOKEN_SELECT)

  return (
    <PageContent onBack={routes.SOL_CONNECTED}>
      <ModalHeading>Send assets</ModalHeading>
      <Form onSubmit={handleSubmit}>
        <Field>
          <FieldLabel>Asset</FieldLabel>
          <TokenSelectorButton type="button" onClick={handleOpenTokenSelector}>
            <TokenSelectorContent>
              <TokenSelectorValue $primary>{selected.symbol}</TokenSelectorValue>
            </TokenSelectorContent>
            <TokenSelectorRight>
              <TokenSelectorValue>
                {availableLabel === '--' ? '--' : `${availableLabel} ${selected.symbol}`}
              </TokenSelectorValue>
              <Arrow width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ArrowChevron
                  stroke="currentColor"
                  d="M7.51431 1.5L11.757 5.74264M7.5 10.4858L11.7426 6.24314"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Arrow>
            </TokenSelectorRight>
          </TokenSelectorButton>
        </Field>

        <Field>
          <FieldLabel>Amount</FieldLabel>
          <AmountInputWrapper>
            <Input
              placeholder="0.00"
              value={sendForm.amount}
              onChange={handleAmountChange}
              inputMode="decimal"
              autoComplete="off"
              style={{ paddingRight: '86px' }}
            />
            <MaxButton type="button" onClick={handleMax} disabled={balanceBase === undefined}>
              Max
            </MaxButton>
          </AmountInputWrapper>
          <HelperText>
            Available: {availableLabel} {selected.symbol}
          </HelperText>
          {sendForm.amount && parsedAmount === null && <ErrorText>Enter a valid amount.</ErrorText>}
          {insufficientBalance && <ErrorText>Insufficient {selected.symbol} balance for this transfer.</ErrorText>}
        </Field>

        <Field>
          <FieldLabel>Recipient address</FieldLabel>
          <Input
            placeholder="Solana address"
            value={sendForm.recipient}
            onChange={(e) => setSendForm((prev) => ({ ...prev, recipient: e.target.value }))}
            autoComplete="off"
          />
          {sendForm.recipient && !recipientValid && <ErrorText>Enter a valid Solana address.</ErrorText>}
        </Field>

        <Button variant="primary" disabled={!canProceed}>
          Review transfer
        </Button>
      </Form>
    </PageContent>
  )
}
