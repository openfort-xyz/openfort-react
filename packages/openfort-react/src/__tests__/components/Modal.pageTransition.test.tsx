import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../components/Openfort/types.js'
import { useLatestAsyncAttempt } from '../../components/Pages/useLatestAsyncAttempt.js'

/**
 * The modal keeps at most two pages in the DOM: the active page and the page
 * currently completing its exit animation. Every other page must stay
 * unmounted so its hooks never run.
 */

let currentRoute: string = routes.PROVIDERS

// Stable identities: the modal treats a changed uiConfig as a re-measure trigger.
const uiConfig = {}
const connector = { id: '' }

vi.mock('../../components/Openfort/useOpenfort.js', () => ({
  useOpenfortRouting: () => ({
    route: { route: currentRoute },
    connector,
    onBack: null,
    headerLeftSlot: null,
    resize: 0,
  }),
  useOpenfortConfig: () => ({ uiConfig }),
  useOpenfort: () => ({ uiConfig }),
}))
vi.mock('../../components/ConnectKitThemeProvider/ConnectKitThemeProvider.js', () => ({
  useThemeContext: () => ({ theme: 'auto', mode: 'auto', customTheme: {} }),
}))
vi.mock('../../wallets/useExternalConnectors.js', () => ({ useExternalConnector: () => undefined }))
vi.mock('../../core/ConnectionStrategyContext.js', () => ({ useConnectionStrategy: () => null }))
vi.mock('../../ethereum/OpenfortEthereumBridgeContext.js', () => ({ useEthereumBridge: () => null }))
// FitText measures DOM sizes that jsdom cannot provide
vi.mock('../../components/Common/FitText/index.js', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
// The polyfill drives a refresh loop that never settles under jsdom
vi.mock('resize-observer-polyfill', () => ({
  default: class {
    observe() {}
    disconnect() {}
  },
}))

const { default: Modal } = await import('../../components/Common/Modal/index.js')

const pages = {
  [routes.PROVIDERS]: <div>providers page</div>,
  [routes.CONNECTORS]: <div>connectors page</div>,
  [routes.ABOUT]: <div>about page</div>,
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function renderModal(pageId: string) {
  currentRoute = pageId
  return render(<Modal open pages={pages} pageId={pageId} />)
}

function navigate(rerender: (ui: React.ReactElement) => void, pageId: string) {
  currentRoute = pageId
  rerender(<Modal open pages={pages} pageId={pageId} />)
}

describe('Modal page mounting', () => {
  afterEach(() => {
    currentRoute = routes.PROVIDERS
  })

  it('mounts only the active page', async () => {
    renderModal(routes.PROVIDERS)

    await screen.findByText('providers page')
    expect(screen.queryByText('connectors page')).toBeNull()
    expect(screen.queryByText('about page')).toBeNull()
  })

  it('keeps the outgoing page mounted while it animates out, then drops it', async () => {
    const { rerender } = renderModal(routes.PROVIDERS)
    await screen.findByText('providers page')

    navigate(rerender, routes.CONNECTORS)

    expect(screen.getByText('connectors page')).toBeTruthy()
    expect(screen.getByText('providers page')).toBeTruthy()
    expect(screen.queryByText('about page')).toBeNull()

    await waitFor(() => expect(screen.queryByText('providers page')).toBeNull())
    expect(screen.getByText('connectors page')).toBeTruthy()
  })

  it('gives the outgoing page an exit class and the incoming page an enter class', async () => {
    const { rerender } = renderModal(routes.PROVIDERS)
    await screen.findByText('providers page')

    // PROVIDERS sits at depth 0 and CONNECTORS at depth 1, so the stack goes deeper.
    navigate(rerender, routes.CONNECTORS)

    expect(document.querySelector('.exit')).toBeTruthy()
    expect(document.querySelector('.active-scale-up')).toBeTruthy()
  })

  it('makes the outgoing subtree hidden and inert while it finishes exiting', async () => {
    const { rerender } = renderModal(routes.PROVIDERS)
    await screen.findByText('providers page')

    navigate(rerender, routes.CONNECTORS)

    const outgoing = screen.getByText('providers page').parentElement
    expect(outgoing?.getAttribute('aria-hidden')).toBe('true')
    expect(outgoing?.hasAttribute('inert')).toBe(true)
    expect(screen.getByText('connectors page').parentElement?.hasAttribute('aria-hidden')).toBe(false)
    expect(screen.getByText('connectors page').parentElement?.hasAttribute('inert')).toBe(false)
  })

  it('does not let outgoing async work route after Back navigation', async () => {
    const recovery = deferred()
    const routeToSuccess = vi.fn()
    const RecoveringPage = () => {
      const { beginAttempt, isCurrentAttempt } = useLatestAsyncAttempt()
      return (
        <button
          type="button"
          onClick={async () => {
            const attempt = beginAttempt()
            await recovery.promise
            if (isCurrentAttempt(attempt)) routeToSuccess()
          }}
        >
          Start recovery
        </button>
      )
    }
    const asyncPages = {
      ...pages,
      [routes.PROVIDERS]: <RecoveringPage />,
    }
    currentRoute = routes.PROVIDERS
    const { rerender } = render(<Modal open pages={asyncPages} pageId={routes.PROVIDERS} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start recovery' }))

    currentRoute = routes.CONNECTORS
    rerender(<Modal open pages={asyncPages} pageId={routes.CONNECTORS} />)
    await act(async () => recovery.resolve())

    expect(screen.getByText('Start recovery')).toBeTruthy()
    expect(routeToSuccess).not.toHaveBeenCalled()
  })

  it('renders no page for a route that has none', async () => {
    renderModal(routes.PROVIDERS)
    await screen.findByText('providers page')

    render(<Modal open pages={pages} pageId="missingRoute" />)

    await waitFor(() => expect(screen.queryAllByText('providers page')).toHaveLength(1))
    expect(screen.queryByText('about page')).toBeNull()
  })
})
