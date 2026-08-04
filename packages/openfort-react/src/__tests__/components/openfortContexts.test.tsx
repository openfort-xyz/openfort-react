import { RecoveryMethod } from '@openfort/openfort-js'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const provider = vi.hoisted(() => ({ render: vi.fn() }))

/**
 * OpenfortProvider publishes theme, routing, form, signature and config state on separate
 * contexts. A component that reads only one of them must not re-render when
 * another changes — typing in a form field is the hot path.
 */

vi.mock('../../openfort/CoreOpenfortProvider.js', () => ({
  CoreOpenfortProvider: ({ children }: { children: React.ReactNode }) => {
    provider.render()
    return <>{children}</>
  },
}))
vi.mock('../../hooks/useGoogleFont.js', () => ({ useThemeFont: () => {} }))

const { OpenfortProvider } = await import('../../components/Openfort/OpenfortProvider.js')
const { useOpenfort, useOpenfortConfig, useOpenfortForms, useOpenfortRouting, useOpenfortSignRequest } = await import(
  '../../components/Openfort/useOpenfort.js'
)

type Setters = {
  setEmailInput: (value: string) => void
  setRoute: (route: string) => void
  setSignRequest: ReturnType<typeof useOpenfortSignRequest>['setSignRequest']
}

function renderCounters() {
  provider.render.mockClear()
  const renders = { routing: 0, forms: 0, signature: 0, combined: 0 }
  const setters = {} as Setters

  const RoutingConsumer = () => {
    const routing = useOpenfortRouting()
    renders.routing += 1
    setters.setRoute = (route) => routing.setRoute(route as never)
    return null
  }
  const FormConsumer = () => {
    const forms = useOpenfortForms()
    renders.forms += 1
    setters.setEmailInput = forms.setEmailInput
    return <span>{forms.emailInput}</span>
  }
  const CombinedConsumer = () => {
    useOpenfort()
    renders.combined += 1
    return null
  }
  const SignatureConsumer = () => {
    const signature = useOpenfortSignRequest()
    renders.signature += 1
    setters.setSignRequest = signature.setSignRequest
    return null
  }

  render(
    <OpenfortProvider publishableKey="pk_test_contexts">
      <RoutingConsumer />
      <FormConsumer />
      <SignatureConsumer />
      <CombinedConsumer />
    </OpenfortProvider>
  )

  return { renders, setters }
}

describe('OpenfortProvider contexts', () => {
  it('repairs the default recovery method when automatic recovery is unavailable', () => {
    let walletRecovery: ReturnType<typeof useOpenfortConfig>['uiConfig']['walletRecovery'] | undefined
    const ConfigConsumer = () => {
      walletRecovery = useOpenfortConfig().uiConfig.walletRecovery
      return null
    }

    render(
      <OpenfortProvider
        publishableKey="pk_test_contexts"
        uiConfig={{
          walletRecovery: {
            allowedMethods: [RecoveryMethod.AUTOMATIC],
            defaultMethod: RecoveryMethod.AUTOMATIC,
          },
        }}
      >
        <ConfigConsumer />
      </OpenfortProvider>
    )

    expect(walletRecovery?.allowedMethods).toEqual([RecoveryMethod.PASSWORD])
    expect(walletRecovery?.defaultMethod).toBe(RecoveryMethod.PASSWORD)
  })

  it('leaves routing-only consumers alone when form state changes', () => {
    const { renders, setters } = renderCounters()
    const routingRenders = renders.routing
    const formRenders = renders.forms

    act(() => setters.setEmailInput('a@b.co'))

    expect(renders.forms).toBeGreaterThan(formRenders)
    expect(renders.routing).toBe(routingRenders)
  })

  it('re-renders consumers of the combined hook on any change', () => {
    const { renders, setters } = renderCounters()
    const combinedRenders = renders.combined

    act(() => setters.setEmailInput('a@b.co'))

    expect(renders.combined).toBeGreaterThan(combinedRenders)
  })

  it('leaves form-only consumers alone when the route changes', () => {
    const { renders, setters } = renderCounters()
    const formRenders = renders.forms
    const routingRenders = renders.routing

    act(() => setters.setRoute('providers'))

    expect(renders.routing).toBeGreaterThan(routingRenders)
    expect(renders.forms).toBe(formRenders)
  })

  it('leaves signature-only consumers alone when a form field changes', () => {
    const { renders, setters } = renderCounters()
    const signatureRenders = renders.signature

    act(() => setters.setEmailInput('a@b.co'))

    expect(renders.signature).toBe(signatureRenders)
  })

  it('preserves the core provider tree while a form field changes', () => {
    const { setters } = renderCounters()
    const coreRenders = provider.render.mock.calls.length

    act(() => setters.setEmailInput('a@b.co'))

    expect(provider.render).toHaveBeenCalledTimes(coreRenders)
  })

  it('leaves form-only consumers alone when the signature request changes', () => {
    const { renders, setters } = renderCounters()
    const formRenders = renders.forms

    act(() =>
      setters.setSignRequest({
        kind: 'message',
        message: 'Sign this message',
        settle: vi.fn(),
      })
    )

    expect(renders.forms).toBe(formRenders)
  })
})
