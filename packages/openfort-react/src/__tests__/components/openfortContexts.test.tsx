import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * OpenfortProvider publishes theme, routing, form and config state on separate
 * contexts. A component that reads only one of them must not re-render when
 * another changes — typing in a form field is the hot path.
 */

vi.mock('../../openfort/CoreOpenfortProvider', () => ({
  CoreOpenfortProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../../hooks/useGoogleFont', () => ({ useThemeFont: () => {} }))

const { OpenfortProvider } = await import('../../components/Openfort/OpenfortProvider.js')
const { useOpenfort, useOpenfortForms, useOpenfortRouting } = await import('../../components/Openfort/useOpenfort.js')

type Setters = {
  setEmailInput: (value: string) => void
  setRoute: (route: string) => void
}

function renderCounters() {
  const renders = { routing: 0, forms: 0, combined: 0 }
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

  render(
    <OpenfortProvider publishableKey="pk_test_contexts">
      <RoutingConsumer />
      <FormConsumer />
      <CombinedConsumer />
    </OpenfortProvider>
  )

  return { renders, setters }
}

describe('OpenfortProvider contexts', () => {
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
})
