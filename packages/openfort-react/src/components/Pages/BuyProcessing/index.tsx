'use client'

import { ChainTypeEnum } from '@openfort/openfort-js'
import { useEffect, useMemo, useRef, useState } from 'react'

import Logos from '../../../assets/logos.js'
import { useEthereumEmbeddedWallet } from '../../../ethereum/hooks/useEthereumEmbeddedWallet.js'
import { useEthereumWalletAssets } from '../../../ethereum/hooks/useEthereumWalletAssets.js'
import { useOpenfortCore } from '../../../openfort/useOpenfort.js'
import { useSolanaEmbeddedWallet } from '../../../solana/hooks/useSolanaEmbeddedWallet.js'
import Button from '../../Common/Button/index.js'
import { usePageActivity } from '../../Common/Modal/pageActivity.js'
import { ModalBody, ModalContent, ModalHeading } from '../../Common/Modal/styles.js'
import SquircleSpinner from '../../Common/SquircleSpinner/index.js'
import { routes } from '../../Openfort/types.js'
import { useOpenfort } from '../../Openfort/useOpenfort.js'
import { PageContent } from '../../PageContent/index.js'
import { createCoinbaseSession } from '../Buy/coinbaseApi.js'
import { resolveOnrampNetwork } from '../Buy/onrampApi.js'
import { SOLANA_BUY_CURRENCIES } from '../Buy/solanaCurrencies.js'
import { createStripeSession } from '../Buy/stripeApi.js'
import { ContinueButtonWrapper, PendingContainer, StackedButtonWrapper } from '../Buy/styles.js'
import { isSameToken } from '../Send/utils.js'

const BuyProcessing = () => {
  const { buyForm, setRoute, triggerResize, publishableKey } = useOpenfort()
  const pageActive = usePageActivity()
  const chainType = useOpenfortCore((s) => s.chainType)

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
  const popupNavigatedRef = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: one onramp session belongs to the current active page and wallet network; the order form is captured when that session starts
  useEffect(() => {
    if (!pageActive) {
      sessionStartedRef.current = false
      popupNavigatedRef.current = false
      setPopupWindow(null)
      return
    }
    if (!address || !network) return
    if (sessionStartedRef.current) return
    sessionStartedRef.current = true
    let cancelled = false
    let reservedPopup: Window | null = null

    const closeReservedPopup = () => {
      if (reservedPopup && !reservedPopup.closed) reservedPopup.close()
    }

    const createSessionAndOpenPopup = async () => {
      if (!fiatAmount || fiatAmount <= 0) {
        setRoute(routes.BUY_SELECT_PROVIDER)
        return
      }

      setIsCreatingSession(true)
      setSessionError(false)

      try {
        const popupWidth = 500
        const popupHeight = 700
        const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX
        const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY
        const width = window.innerWidth
          ? window.innerWidth
          : document.documentElement.clientWidth
            ? document.documentElement.clientWidth
            : screen.width
        const height = window.innerHeight
          ? window.innerHeight
          : document.documentElement.clientHeight
            ? document.documentElement.clientHeight
            : screen.height
        const left = width / 2 - popupWidth / 2 + dualScreenLeft
        const top = height / 2 - popupHeight / 2 + dualScreenTop

        reservedPopup = window.open(
          'about:blank',
          'BuyPopup',
          `scrollbars=yes,width=${popupWidth},height=${popupHeight},top=${top},left=${left}`
        )
        if (!reservedPopup) {
          setSessionError(true)
          return
        }
        reservedPopup.opener = null
        popupNavigatedRef.current = false
        setPopupWindow(reservedPopup)

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
          if (cancelled) return
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
          if (cancelled) return
          onrampUrl = session.onrampUrl
        }

        if (!onrampUrl) {
          closeReservedPopup()
          setPopupWindow(null)
          setSessionError(true)
          return
        }

        // Coinbase onramp rejects requests when fiatCurrency is set to a non-USD currency (e.g. EUR).
        // Strip the param so it uses the user's default currency instead.
        const url = new URL(onrampUrl)
        url.searchParams.delete('fiatCurrency')
        const sanitizedProviderUrl = url.toString()

        if (cancelled || reservedPopup.closed) return
        reservedPopup.location.href = sanitizedProviderUrl
        popupNavigatedRef.current = true
      } catch (_error) {
        if (cancelled) return
        closeReservedPopup()
        setPopupWindow(null)
        setSessionError(true)
      } finally {
        if (!cancelled) setIsCreatingSession(false)
      }
    }

    createSessionAndOpenPopup()
    return () => {
      cancelled = true
      sessionStartedRef.current = false
      closeReservedPopup()
    }
  }, [pageActive, address, network])

  // biome-ignore lint/correctness/useExhaustiveDependencies: these are re-measure triggers, not inputs — each of the three states swaps in a differently sized body (spinner, continue button, error)
  useEffect(() => {
    triggerResize()
  }, [triggerResize, isCreatingSession, showContinueButton, sessionError])

  // Show continue button after 2 seconds
  useEffect(() => {
    if (!pageActive || isCreatingSession) return

    setShowContinueButton(false)
    const timer = setTimeout(() => {
      setShowContinueButton(true)
    }, 2000)
    return () => clearTimeout(timer)
  }, [pageActive, isCreatingSession])

  // Monitor popup window for redirect or close
  useEffect(() => {
    if (!pageActive || !popupWindow || isCreatingSession) return

    const checkPopup = setInterval(() => {
      try {
        // Check if popup is closed
        if (popupWindow.closed) {
          clearInterval(checkPopup)
          setPopupWindow(null)
          // Only auto-advance for Coinbase
          if (popupNavigatedRef.current && buyForm.providerId === 'coinbase') {
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
  }, [pageActive, popupWindow, buyForm.providerId, setRoute, isCreatingSession])

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
