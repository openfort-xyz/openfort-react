import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PageActivityProvider } from '../Common/Modal/pageActivity.js'
import { PageContent } from './index.js'

const h = vi.hoisted(() => ({
  setOnBack: vi.fn(),
  setRoute: vi.fn(),
  setPreviousRoute: vi.fn(),
  setRouteHistory: vi.fn(),
}))

vi.mock('../Openfort/useOpenfort.js', () => ({
  useOpenfort: () => h,
}))

vi.mock('../../hooks/openfort/auth/useSignOut.js', () => ({
  useSignOut: () => ({ signOut: vi.fn() }),
}))

function invokeRegisteredBack() {
  const registration = h.setOnBack.mock.lastCall?.[0]
  expect(registration).toBeTypeOf('function')
  const handler = registration()
  expect(handler).toBeTypeOf('function')
  handler()
}

describe('PageContent Back ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps Back bound to the active page through a rapid A to B to A transition', () => {
    const pageA = vi.fn()
    const pageB = vi.fn()
    const view = (activePage: 'A' | 'B') => (
      <>
        <PageActivityProvider active={activePage === 'A'}>
          <PageContent onBack={pageA}>A</PageContent>
        </PageActivityProvider>
        <PageActivityProvider active={activePage === 'B'}>
          <PageContent onBack={pageB}>B</PageContent>
        </PageActivityProvider>
      </>
    )
    const { rerender } = render(view('A'))

    invokeRegisteredBack()
    expect(pageA).toHaveBeenCalledOnce()
    expect(pageB).not.toHaveBeenCalled()

    act(() => rerender(view('B')))
    invokeRegisteredBack()
    expect(pageB).toHaveBeenCalledOnce()

    act(() => rerender(view('A')))
    invokeRegisteredBack()
    expect(pageA).toHaveBeenCalledTimes(2)
    expect(pageB).toHaveBeenCalledOnce()
  })
})
