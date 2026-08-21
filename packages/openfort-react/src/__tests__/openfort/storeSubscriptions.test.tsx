import type { Openfort, User } from '@openfort/openfort-js'
import { ChainTypeEnum } from '@openfort/openfort-js'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createMockOpenfortClient } from '../mocks/openfortClient.js'

/**
 * `useOpenfortCore` subscribes through a selector, so a consumer only re-renders
 * when the slice it selected changes — and never for modal state such as the
 * text in a form field.
 */

vi.mock('../../openfort/CoreOpenfortProvider', () => ({
  CoreOpenfortProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../../hooks/useGoogleFont', () => ({ useThemeFont: () => {} }))

const { OpenfortProvider } = await import('../../components/Openfort/OpenfortProvider.js')
const { useOpenfortForms } = await import('../../components/Openfort/useOpenfort.js')
const { StoreContext } = await import('../../openfort/context.js')
const { createOpenfortStore } = await import('../../openfort/store.js')
const { useOpenfortCore } = await import('../../openfort/useOpenfort.js')

function renderCounters() {
  const store = createOpenfortStore(ChainTypeEnum.EVM, createMockOpenfortClient() as unknown as Openfort)
  const renders = { user: 0, walletStatus: 0 }
  const setters = {} as { setEmailInput: (value: string) => void }

  const UserConsumer = () => {
    useOpenfortCore((s) => s.user)
    renders.user += 1
    return null
  }
  const WalletStatusConsumer = () => {
    const walletStatus = useOpenfortCore((s) => s.walletStatus)
    renders.walletStatus += 1
    return <span>{walletStatus.status}</span>
  }
  const FormConsumer = () => {
    setters.setEmailInput = useOpenfortForms().setEmailInput
    return null
  }

  render(
    <OpenfortProvider publishableKey="pk_test_store_subscriptions">
      <StoreContext.Provider value={store}>
        <UserConsumer />
        <WalletStatusConsumer />
        <FormConsumer />
      </StoreContext.Provider>
    </OpenfortProvider>
  )

  return { renders, setters, store }
}

describe('useOpenfortCore selector subscriptions', () => {
  it('leaves a user-only consumer alone when walletStatus changes', () => {
    const { renders, store } = renderCounters()
    const userRenders = renders.user
    const walletStatusRenders = renders.walletStatus

    act(() => store.getState().setWalletStatus({ status: 'creating' }))

    expect(renders.walletStatus).toBeGreaterThan(walletStatusRenders)
    expect(renders.user).toBe(userRenders)
  })

  it('re-renders a user-only consumer when the user changes', () => {
    const { renders, store } = renderCounters()
    const userRenders = renders.user

    act(() => store.getState().setUser({ id: 'usr_1' } as User))

    expect(renders.user).toBeGreaterThan(userRenders)
  })

  it('leaves store consumers alone when a form field changes', () => {
    const { renders, setters } = renderCounters()
    const userRenders = renders.user
    const walletStatusRenders = renders.walletStatus

    act(() => setters.setEmailInput('a@b.co'))

    expect(renders.user).toBe(userRenders)
    expect(renders.walletStatus).toBe(walletStatusRenders)
  })

  it('drops a wallet status write that repeats the current value', () => {
    const { renders, store } = renderCounters()

    act(() => store.getState().setWalletStatus({ status: 'creating' }))
    const walletStatusRenders = renders.walletStatus

    act(() => store.getState().setWalletStatus({ status: 'creating' }))

    expect(renders.walletStatus).toBe(walletStatusRenders)
  })
})
