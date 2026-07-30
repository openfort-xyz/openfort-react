'use client'

import { useEffect, useRef } from 'react'
import styled from '../../../styles/styled'

// Stripe's crypto-onramp loader (what @stripe/crypto's loadStripeOnramp injects).
// Injected on demand so the SDK ships no Stripe dependency and apps that never
// reach an embedded onramp never load it.
const SCRIPT_SRC = 'https://crypto-js.stripe.com/crypto-onramp-outer.js'

type StripeOnrampConstructor = new (
  publishableKey: string
) => {
  createSession: (options: { clientSecret: string }) => {
    mount: (element: HTMLElement) => void
  }
}

declare global {
  interface Window {
    StripeOnramp?: StripeOnrampConstructor
  }
}

let scriptPromise: Promise<StripeOnrampConstructor> | null = null

function loadStripeOnramp(): Promise<StripeOnrampConstructor> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe onramp needs a browser'))
  if (window.StripeOnramp) return Promise.resolve(window.StripeOnramp)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.onload = () => {
        if (window.StripeOnramp) resolve(window.StripeOnramp)
        else reject(new Error('StripeOnramp missing after script load'))
      }
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Failed to load the Stripe onramp script'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

const EmbedContainer = styled.div`
  width: 100%;
  min-height: 420px;
  margin-top: 8px;
  border-radius: 12px;
  overflow: hidden;
`

type StripeOnrampEmbedProps = {
  /** Openfort's Stripe publishable key, from the payment method (public by design). */
  publishableKey: string
  /** The Stripe onramp session secret (`cos_…_secret`) from the payment method. */
  clientSecret: string
  /** Loading/mounting failed — the caller falls back to the hosted checkout. */
  onError: (error: Error) => void
}

/**
 * In-page mount for Stripe's embedded onramp (the `embedded` angle). Settlement
 * stays webhook-driven on the funding session — this component only hosts the
 * payment UI; the session poll in useOnramp remains the source of truth.
 */
const StripeOnrampEmbed = ({ publishableKey, clientSecret, onError }: StripeOnrampEmbedProps) => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const mountedSecret = useRef<string | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    const node = nodeRef.current
    if (!node || mountedSecret.current === clientSecret) return
    mountedSecret.current = clientSecret
    let cancelled = false
    loadStripeOnramp()
      .then((StripeOnramp) => {
        if (cancelled || !nodeRef.current) return
        new StripeOnramp(publishableKey).createSession({ clientSecret }).mount(nodeRef.current)
      })
      .catch((e) => {
        mountedSecret.current = null
        if (!cancelled) onErrorRef.current(e instanceof Error ? e : new Error(String(e)))
      })
    return () => {
      cancelled = true
      // Stripe's session has no unmount API; dropping the DOM subtree is the
      // documented teardown for the embedded component.
      node.replaceChildren()
    }
  }, [publishableKey, clientSecret])

  return <EmbedContainer ref={nodeRef} />
}

export default StripeOnrampEmbed
