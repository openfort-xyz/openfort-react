import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../components/Openfort/types.js'

const RESET_EMAIL = 'reset-user@example.test'
const RESET_STATE = 'fake-reset-state'

const h = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  signInEmail: vi.fn(),
  setEmailInput: vi.fn(),
  setOnBack: vi.fn(),
  setPreviousRoute: vi.fn(),
  setRoute: vi.fn(),
  setRouteHistory: vi.fn(),
  triggerResize: vi.fn(),
  requestResetPassword: vi.fn(),
}))

vi.mock('../../hooks/openfort/auth/useEmailAuth.js', () => ({
  useEmailAuth: () => ({
    resetPassword: h.resetPassword,
    signInEmail: h.signInEmail,
    isLoading: false,
  }),
}))

vi.mock('../../components/Openfort/useOpenfort.js', () => ({
  useOpenfort: () => ({
    emailInput: RESET_EMAIL,
    setEmailInput: h.setEmailInput,
    setOnBack: h.setOnBack,
    setPreviousRoute: h.setPreviousRoute,
    setRoute: h.setRoute,
    setRouteHistory: h.setRouteHistory,
    triggerResize: h.triggerResize,
  }),
}))

vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: unknown) => unknown) =>
    selector({ client: { auth: { requestResetPassword: h.requestResetPassword } } }),
}))

const { default: ForgotPassword } = await import('../../components/Pages/ForgotPassword/index.js')

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function openResetPage() {
  window.history.replaceState(
    { preserved: true },
    '',
    `/account?openfortForgotPasswordUI=true&email=${encodeURIComponent(RESET_EMAIL)}?state=${RESET_STATE}&keep=value`
  )
}

describe('ForgotPassword reset URL handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.head.querySelectorAll('meta[name="referrer"]').forEach((meta) => {
      meta.remove()
    })
    window.history.replaceState({}, '', '/')
    h.resetPassword.mockResolvedValue({})
    h.signInEmail.mockResolvedValue({})
  })

  it('cleans reset credentials immediately and restores the existing referrer policy on unmount', () => {
    const existingReferrerMeta = document.createElement('meta')
    existingReferrerMeta.name = 'referrer'
    existingReferrerMeta.content = 'strict-origin'
    document.head.appendChild(existingReferrerMeta)
    openResetPage()

    const { unmount } = render(<ForgotPassword />)

    expect(window.location.pathname + window.location.search).toBe('/account?keep=value')
    expect(window.history.state).toEqual({ preserved: true })
    expect(document.head.querySelectorAll('meta[name="referrer"]')).toHaveLength(1)
    expect(existingReferrerMeta.content).toBe('no-referrer')

    unmount()

    expect(existingReferrerMeta.isConnected).toBe(true)
    expect(existingReferrerMeta.content).toBe('strict-origin')
  })

  it('keeps captured credentials available for a retry after reset failure while the URL stays clean', async () => {
    h.resetPassword.mockResolvedValueOnce({ error: new Error('reset rejected') }).mockResolvedValueOnce({})
    openResetPage()
    render(<ForgotPassword />)

    expect(window.location.pathname + window.location.search).toBe('/account?keep=value')
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')

    const passwordInput = screen.getByPlaceholderText('Enter your new password')
    fireEvent.change(passwordInput, { target: { value: 'new-password-fixture' } })
    const form = passwordInput.closest('form')
    if (!form) throw new Error('Expected the reset input to be inside a form')
    fireEvent.submit(form)

    expect(
      await screen.findByText('Could not reset your password. Request a new reset email and try again.')
    ).toBeTruthy()
    expect(h.resetPassword).toHaveBeenNthCalledWith(1, {
      email: RESET_EMAIL,
      password: 'new-password-fixture',
      state: RESET_STATE,
    })
    expect(window.location.pathname + window.location.search).toBe('/account?keep=value')

    fireEvent.submit(form)

    await waitFor(() => expect(h.resetPassword).toHaveBeenCalledTimes(2))
    expect(h.resetPassword).toHaveBeenNthCalledWith(2, {
      email: RESET_EMAIL,
      password: 'new-password-fixture',
      state: RESET_STATE,
    })
    await waitFor(() => expect(h.setRoute).toHaveBeenCalledWith(routes.LOAD_WALLETS))
    expect(window.location.pathname + window.location.search).toBe('/account?keep=value')
  })

  it('requests one reset email for a submit-button click and blocks synchronous reentry', () => {
    const request = deferred<unknown>()
    h.requestResetPassword.mockReturnValueOnce(request.promise)
    render(<ForgotPassword />)

    const form = screen.getByPlaceholderText('Enter your email').closest('form')
    if (!form) throw new Error('Expected the email input to be inside a form')
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (!button) throw new Error('Expected an explicit submit button')
    expect(button.getAttribute('type')).toBe('submit')
    fireEvent.click(button)
    expect(h.requestResetPassword).toHaveBeenCalledOnce()
    fireEvent.submit(form)

    expect(h.requestResetPassword).toHaveBeenCalledOnce()
    expect(h.requestResetPassword).toHaveBeenCalledWith({
      email: RESET_EMAIL,
      redirectUrl: `${window.location.origin}/?openfortForgotPasswordUI=true&email=${RESET_EMAIL}`,
    })
  })

  it('submits one password reset while the first request is pending', () => {
    const reset = deferred<Record<string, never>>()
    h.resetPassword.mockReturnValueOnce(reset.promise)
    openResetPage()
    render(<ForgotPassword />)

    fireEvent.change(screen.getByPlaceholderText('Enter your new password'), {
      target: { value: 'new-password-fixture' },
    })
    const form = screen.getByPlaceholderText('Enter your new password').closest('form')
    if (!form) throw new Error('Expected the password input to be inside a form')
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (!button) throw new Error('Expected an explicit submit button')
    expect(button.getAttribute('type')).toBe('submit')
    fireEvent.click(button)
    expect(h.resetPassword).toHaveBeenCalledOnce()
    fireEvent.submit(form)

    expect(h.resetPassword).toHaveBeenCalledOnce()

    expect(h.signInEmail).not.toHaveBeenCalled()
  })
})
