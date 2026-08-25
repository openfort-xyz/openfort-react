import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  let generation = 0
  let tail = Promise.resolve()
  const enqueue = <T,>(mutation: () => Promise<T>) => {
    const result = tail.then(mutation)
    tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
  return {
    loader: vi.fn(),
    setRoute: vi.fn(),
    storeCredentials: vi.fn(),
    triggerResize: vi.fn(),
    updateUser: vi.fn(),
    captureAuthSession: () => {
      const captured = generation
      return { isCurrent: () => generation === captured }
    },
    startAuthenticatedMutation: (mutation: () => Promise<unknown>) => {
      const captured = generation
      return { result: enqueue(mutation), isCurrent: () => generation === captured }
    },
    startAuthTransition: (mutation: () => Promise<unknown>) => {
      const captured = ++generation
      return { result: enqueue(mutation), isCurrent: () => generation === captured }
    },
    resetTransitions: () => {
      generation = 0
      tail = Promise.resolve()
    },
  }
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

vi.mock('../Openfort/useOpenfort.js', () => ({
  useOpenfort: () => ({
    connector: { id: 'google', type: 'oauth' },
    setRoute: h.setRoute,
    triggerResize: h.triggerResize,
  }),
}))

vi.mock('../../openfort/useOpenfort.js', () => ({
  useOpenfortCore: (selector: (state: unknown) => unknown) =>
    selector({
      client: { auth: { storeCredentials: h.storeCredentials } },
      updateUser: h.updateUser,
      user: null,
    }),
}))

vi.mock('../../openfort/authTransitionContext.js', () => ({
  useAuthTransitions: () => ({
    captureAuthSession: h.captureAuthSession,
    startAuthenticatedMutation: h.startAuthenticatedMutation,
    startAuthTransition: h.startAuthTransition,
  }),
}))

vi.mock('../Common/Loading/index.js', () => ({
  default: (props: unknown) => {
    h.loader(props)
    return null
  },
}))

vi.mock('../PageContent/index.js', () => ({
  PageContent: ({ children }: { children: React.ReactNode }) => children,
}))

const { default: ConnectWithOAuth } = await import('./ConnectWithOAuth.js')

describe('ConnectWithOAuth auth transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.resetTransitions()
    window.history.replaceState(
      {},
      '',
      '/?openfortAuthProviderUI=google&user_id=user-id&access_token=fake-access-token'
    )
  })

  it('settles the modal when another auth transition supersedes pending credentials', async () => {
    const credentials = deferred<void>()
    h.storeCredentials.mockReturnValueOnce(credentials.promise)
    render(<ConnectWithOAuth />)
    await waitFor(() => expect(h.storeCredentials).toHaveBeenCalledOnce())

    const newerTransition = h.startAuthTransition(async () => undefined)
    await act(async () => {
      credentials.resolve()
      await newerTransition.result
    })

    await waitFor(() =>
      expect(h.loader).toHaveBeenLastCalledWith(
        expect.objectContaining({
          description: 'Authentication changed before this sign-in completed. Please try again.',
          isError: true,
        })
      )
    )
    expect(h.updateUser).not.toHaveBeenCalled()
    expect(h.setRoute).not.toHaveBeenCalled()
    expect(h.triggerResize).toHaveBeenCalledOnce()
  })
})
