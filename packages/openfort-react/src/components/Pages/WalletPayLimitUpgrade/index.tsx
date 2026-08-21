'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useFundingClient } from '../../../hooks/openfort/useFunding'
import styled from '../../../styles/styled'
import { logger } from '../../../utils/logger'
import Button from '../../Common/Button'
import { ErrorText } from '../../Common/ErrorText'
import { ModalBody, ModalHeading } from '../../Common/Modal/styles'
import { FundingMethod, routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { ContinueButtonWrapper, StackedButtonWrapper } from '../Buy/styles'
import { Skeleton, SkeletonStack } from '../Deposit/styles'

// The provider's form reports its own height; this is only the starting box.
const UPGRADE_FRAME_HEIGHT = 320

// A frame blocked by the embedding origin still fires `load` but never speaks,
// so silence past this is the only signal that it isn't running.
const FRAME_SILENCE_MS = 6_000

const UpgradeFrame = styled.iframe<{ $height: number }>`
  width: 100%;
  height: ${({ $height }) => $height}px;
  margin-top: 8px;
  border: 0;
  border-radius: 12px;
  background: transparent;
`

/**
 * Raises the buyer's wallet-pay spending limit through the provider's own
 * hosted form.
 *
 * Hosted deliberately: the form asks for part of a social security number,
 * which must never touch our code or servers. We mount it, listen for the
 * outcome, and never see the input.
 */
const WalletPayLimitUpgrade: React.FC = () => {
  const { buyForm, setRoute, triggerResize } = useOpenfort()
  const client = useFundingClient({ useBackendUrl: true })

  const [url, setUrl] = useState<string | null>(null)
  const [height, setHeight] = useState(UPGRADE_FRAME_HEIGHT)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'approved' | 'pending' | null>(null)
  const [frameSilent, setFrameSilent] = useState(false)
  const frameSpokeRef = useRef(false)

  const phoneNumber = buyForm.walletPay?.phoneNumber
  const method = buyForm.method === FundingMethod.GOOGLE_PAY ? 'google_pay' : 'apple_pay'

  // Mint the single-use form URL once per mount.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !client) return
    if (!phoneNumber) {
      setRoute(routes.BUY)
      return
    }
    startedRef.current = true
    client.authIntents
      .startLimitUpgrade({ phoneNumber, method })
      .then((result) => setUrl(result.url))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not start the limit upgrade.'))
  }, [client, phoneNumber, method, setRoute])

  useEffect(() => {
    triggerResize()
  }, [triggerResize, url, height, error, done, frameSilent])

  // Start the silence timer only once the frame is actually mounted.
  useEffect(() => {
    if (!url) return
    frameSpokeRef.current = false
    setFrameSilent(false)
    const timer = setTimeout(() => {
      if (!frameSpokeRef.current) setFrameSilent(true)
    }, FRAME_SILENCE_MS)
    return () => clearTimeout(timer)
  }, [url])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://pay.coinbase.com') return
      let payload: unknown = event.data
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload)
        } catch {
          return
        }
      }
      const { eventName, data } = (payload ?? {}) as { eventName?: string; data?: { errorCode?: string } }
      if (!eventName?.startsWith('onramp_api.')) return
      // Any message proves the frame rendered.
      frameSpokeRef.current = true
      setFrameSilent(false)

      if (eventName === 'onramp_api.resize') {
        const next = (data as unknown as { height?: number })?.height
        if (typeof next === 'number' && next > 0) setHeight(next)
      } else if (eventName === 'onramp_api.upgrade_approved') {
        setDone('approved')
      } else if (eventName === 'onramp_api.upgrade_pending') {
        setDone('pending')
      } else if (eventName === 'onramp_api.cancel') {
        setRoute(routes.BUY)
      } else if (eventName === 'onramp_api.upgrade_submit_error') {
        // The form re-shows itself for anything recoverable, so an error that
        // reaches us is terminal for this attempt.
        setError(
          data?.errorCode === 'user_blocked'
            ? "We can't raise your limit at this time."
            : 'That could not be verified. Please try again.'
        )
      } else if (eventName === 'onramp_api.load_error') {
        setError('The verification form could not be loaded. Please try again.')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setRoute])

  const handleBack = () => setRoute(routes.BUY)

  if (done) {
    return (
      <PageContent onBack={handleBack}>
        <ModalHeading>{done === 'approved' ? 'Limit raised' : 'Under review'}</ModalHeading>
        <ModalBody>
          {done === 'approved'
            ? 'Your limit has been raised. You can continue your purchase.'
            : 'Your limit upgrade is being reviewed. You can still buy up to your current limit.'}
        </ModalBody>
        <ContinueButtonWrapper>
          <Button variant="primary" onClick={handleBack}>
            Continue
          </Button>
        </ContinueButtonWrapper>
      </PageContent>
    )
  }

  return (
    <PageContent onBack={handleBack}>
      <ModalHeading>Raise your limit</ModalHeading>
      <ModalBody>Verify your identity to buy more than your current limit allows.</ModalBody>

      {!url && !error && (
        <SkeletonStack>
          <Skeleton $h="16px" $w="70%" />
          <Skeleton $h="120px" />
        </SkeletonStack>
      )}

      {url && <UpgradeFrame src={url} title="Raise your limit" $height={height} referrerPolicy="no-referrer" />}

      {frameSilent && url && (
        <>
          <ModalBody>The form couldn’t load here. Open it in a new tab to finish verifying.</ModalBody>
          <StackedButtonWrapper>
            <Button
              variant="primary"
              onClick={() => {
                window.open(url, '_blank', 'noopener,noreferrer')
                logger.log('[wallet-pay] limit upgrade opened in a tab')
              }}
            >
              Open in a new tab
            </Button>
          </StackedButtonWrapper>
        </>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </PageContent>
  )
}

export default WalletPayLimitUpgrade
