'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useMemo, useRef, useState } from 'react'

import Logos from '../../../assets/logos'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets'
import { useOpenfortCore } from '../../../openfort/useOpenfort'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet'
import Button from '../../Common/Button'
import { ModalBody, ModalContent, ModalHeading } from '../../Common/Modal/styles'
import SquircleSpinner from '../../Common/SquircleSpinner'
import { routes } from '../../Openfort/types'
import { useOpenfort } from '../../Openfort/useOpenfort'
import { PageContent } from '../../PageContent'
import { buyPopupFeatures, closeBuyPopup, navigateBuyPopup, takeBuyPopup } from '../Buy/buyPopup'
import { createCoinbaseSession } from '../Buy/coinbaseApi'
import { resolveOnrampNetwork } from '../Buy/onrampApi'
import { SOLANA_BUY_CURRENCIES } from '../Buy/solanaCurrencies'
import { createStripeSession } from '../Buy/stripeApi'
import { ContinueButtonWrapper, PendingContainer, StackedButtonWrapper } from '../Buy/styles'
import { isSameToken } from '../Send/utils'

const BuyProcessing = () => {
  const { buyForm, setRoute, triggerResize, publishableKey } = useOpenfort()
  const { chainType } = useOpenfortCore()

  // Use chain-specific hooks
  const ethereumWallet = useEthereumEmbeddedWallet()
  const solanaWallet = useSolanaEmbeddedWallet()
  const wallet = chainType === ChainTypeEnum.EVM ? ethereumWallet : solanaWallet

  const isConnected = wallet.status === 'connected'
  const address = isConnected ? wallet.address : undefined
  const chainId = isConnected && chainType === ChainTypeEnum.EVM ? (wallet as typeof ethereumWallet).chainId : undefined
  const network = resolveOnrampNetwork(chainType, chainId)

  const [popupWindow, setPopupWindow] = useState<Window | null>(null)
  const [showContinueButton, setShowContinueButton] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(true)
  const [sessionError, setSessionError] = useState(false)
  // Set when the session exists but the browser refused to open a window for it.
  const [blockedProviderUrl, setBlockedProviderUrl] = useState<string | null>(null)

  const { data: ethAssets } = useEthereumWalletAssets()
  const assets = chainType === ChainTypeEnum.SVM ? SOLANA_BUY_CURRENCIES : ethAssets

  const matchedToken = useMemo(
    () => assets?.find((asset) => isSameToken(asset, buyForm.asset)),
    [assets, buyForm.asset]
  )

  const selectedTokenOption = matchedToken ?? assets?.[0]
  const selectedToken = selectedTokenOption ?? buyForm.asset

  const fiatAmount = useMemo(() => {
    const normalized = buyForm.amount
    if (!normalized) return null
    const numeric = Number(normalized)
    if (!Number.isFinite(numeric)) return null
    return numeric
  }, [buyForm.amount])

  // Create session and open popup once wallet is ready
  const sessionStartedRef = useRef(false)
  useEffect(() => {
    if (!address || !network) return
    if (sessionStartedRef.current) return
    sessionStartedRef.current = true

    const createSessionAndOpenPopup = async () => {
      // Claimed up front so every exit path below can close it.
      const reservedPopup = takeBuyPopup()

      if (!fiatAmount || fiatAmount <= 0) {
        if (reservedPopup) reservedPopup.close()
        setRoute(routes.BUY_SELECT_PROVIDER)
        return
      }

      setIsCreatingSession(true)
      setSessionError(false)

      try {
        let onrampUrl: string | null = null

        // Create session based on selected provider
        if (buyForm.providerId === 'coinbase') {
          const session = await createCoinbaseSession({
            token: selectedToken,
            network,
            publishableKey,
            destinationAddress: address,
            sourceAmount: fiatAmount.toFixed(2),
            sourceCurrency: buyForm.currency,
            redirectUrl: `${window.location.origin}?coinbase_onramp=success`,
          })
          onrampUrl = session.onrampUrl
        } else if (buyForm.providerId === 'stripe') {
          const session = await createStripeSession({
            token: selectedToken,
            network,
            publishableKey,
            destinationAddress: address,
            sourceAmount: fiatAmount.toFixed(2),
            sourceCurrency: buyForm.currency,
            redirectUrl: `${window.location.origin}?stripe_onramp=success`,
          })
          onrampUrl = session.onrampUrl
        }

        if (!onrampUrl) {
          if (reservedPopup) reservedPopup.close()
          setSessionError(true)
          return
        }

        // Coinbase onramp rejects requests when fiatCurrency is set to a non-USD currency (e.g. EUR).
        // Strip the param so it uses the user's default currency instead.
        const url = new URL(onrampUrl)
        url.searchParams.delete('fiatCurrency')
        const sanitizedProviderUrl = url.toString()

        if (typeof window === 'undefined') return

        if (reservedPopup && navigateBuyPopup(reservedPopup, sanitizedProviderUrl)) {
          setPopupWindow(reservedPopup)
          return
        }

        // No usable window: either the user dismissed it, or the popup blocker took
        // it despite the gesture. Retry inline — this still succeeds when the session
        // resolved fast enough to stay inside the activation window.
        const popup = window.open(sanitizedProviderUrl, 'BuyPopup', buyPopupFeatures())

        if (popup) {
          setPopupWindow(popup)
          return
        }

        // Give up on opening it ourselves and let the user click through. A click
        // handler always carries a fresh activation, so that open cannot be blocked.
        setBlockedProviderUrl(sanitizedProviderUrl)
      } catch (_error) {
        if (reservedPopup) reservedPopup.close()
        setSessionError(true)
      } finally {
        setIsCreatingSession(false)
      }
    }

    createSessionAndOpenPopup()

    // Closes the reserved window only while it is still unclaimed — once
    // createSessionAndOpenPopup takes it, this is a no-op and the popup the user is
    // paying in survives. Covers backing out before the wallet was ready to start.
    return closeBuyPopup
  }, [address, network]) // Run when wallet becomes ready

  // Trigger resize on mount and when state changes
  useEffect(() => {
    triggerResize()
  }, [triggerResize, isCreatingSession, showContinueButton, sessionError, blockedProviderUrl])

  // Show continue button after 2 seconds
  useEffect(() => {
    if (isCreatingSession) return

    setShowContinueButton(false)
    const timer = setTimeout(() => {
      setShowContinueButton(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [isCreatingSession])

  // Monitor popup window for redirect or close
  useEffect(() => {
    if (!popupWindow || isCreatingSession) return

    const checkPopup = setInterval(() => {
      try {
        // Check if popup is closed
        if (popupWindow.closed) {
          clearInterval(checkPopup)
          setPopupWindow(null)
          // Only auto-advance for Coinbase
          if (buyForm.providerId === 'coinbase') {
            setRoute(routes.BUY_COMPLETE)
          }
          return
        }

        // Try to check if popup has redirected to our success URL
        try {
          const popupUrl = popupWindow.location.href
          if (popupUrl.includes('coinbase_onramp=success') || popupUrl.includes('stripe_onramp=success')) {
            popupWindow.close()
            setPopupWindow(null)
            setRoute(routes.BUY_COMPLETE)
            clearInterval(checkPopup)
          }
        } catch (_e) {
          // Cross-origin error is expected while on provider domain
          // We can't read the URL until it redirects back to our domain
        }
      } catch (_error) {
        // Handle any other errors
        clearInterval(checkPopup)
      }
    }, 500)

    return () => {
      clearInterval(checkPopup)
    }
  }, [popupWindow, buyForm.providerId, setRoute, isCreatingSession])

  const handleCancel = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close()
    }
    setPopupWindow(null)
    setRoute(routes.BUY)
  }

  const handleContinue = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close()
    }
    setPopupWindow(null)
    setRoute(routes.BUY_COMPLETE)
  }

  const handleBack = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close()
    }
    setPopupWindow(null)
    setRoute(routes.BUY_SELECT_PROVIDER)
  }

  if (sessionError) {
    return (
      <PageContent onBack={handleBack}>
        <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
          <ModalHeading>Error</ModalHeading>
          <ModalBody>
            Failed to create payment session.
            <br />
            Please try again.
          </ModalBody>
          <ContinueButtonWrapper style={{ marginTop: 24 }}>
            <Button variant="primary" onClick={handleBack}>
              Go Back
            </Button>
          </ContinueButtonWrapper>
        </ModalContent>
      </PageContent>
    )
  }

  const isStripe = buyForm.providerId === 'stripe'
  const isCoinbase = buyForm.providerId === 'coinbase'
  const isProvider = isStripe || isCoinbase

  if (blockedProviderUrl) {
    const openBlockedProvider = () => {
      const popup = window.open(blockedProviderUrl, 'BuyPopup', buyPopupFeatures())
      if (popup) {
        setBlockedProviderUrl(null)
        setPopupWindow(popup)
      }
    }

    return (
      <PageContent onBack={handleBack}>
        <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
          <ModalHeading>Popup blocked</ModalHeading>
          <ModalBody>
            Your payment is ready, but your browser blocked the {isStripe ? 'Stripe' : 'Coinbase'} window.
            <br />
            Allow popups for this site, or continue below.
          </ModalBody>
          <ContinueButtonWrapper style={{ marginTop: 24 }}>
            <Button variant="primary" onClick={openBlockedProvider}>
              Continue to {isStripe ? 'Stripe' : 'Coinbase'}
            </Button>
          </ContinueButtonWrapper>
        </ModalContent>
      </PageContent>
    )
  }

  if (isCreatingSession) {
    return (
      <PageContent onBack={handleBack}>
        <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
          <ModalHeading>Creating Session</ModalHeading>
          <ModalBody>Please wait...</ModalBody>
          <PendingContainer>
            <SquircleSpinner
              logo={
                isProvider ? (
                  <div
                    style={{
                      padding: '12px',
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isStripe && <Logos.Stripe />}
                    {isCoinbase && <Logos.CoinbasePay />}
                  </div>
                ) : undefined
              }
              connecting={true}
            />
          </PendingContainer>
        </ModalContent>
      </PageContent>
    )
  }

  return (
    <PageContent onBack={handleCancel}>
      <ModalContent style={{ paddingBottom: 18, textAlign: 'center' }}>
        <ModalHeading>Processing Purchase</ModalHeading>
        <ModalBody>Complete the purchase in the popup window...</ModalBody>

        <PendingContainer>
          <SquircleSpinner
            logo={
              <div
                style={{
                  padding: '12px',
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isStripe && <Logos.Stripe />}
                {isCoinbase && <Logos.CoinbasePay />}
                {!isStripe && !isCoinbase && <Logos.Openfort />}
              </div>
            }
            connecting={true}
          />
        </PendingContainer>

        {showContinueButton && <ModalBody>Click Continue when you are done.</ModalBody>}

        {showContinueButton && (
          <>
            <StackedButtonWrapper>
              <Button variant="primary" onClick={handleContinue}>
                Continue
              </Button>
            </StackedButtonWrapper>
            <StackedButtonWrapper>
              <Button variant="secondary" onClick={handleCancel}>
                Cancel
              </Button>
            </StackedButtonWrapper>
          </>
        )}
      </ModalContent>
    </PageContent>
  )
}

export default BuyProcessing
