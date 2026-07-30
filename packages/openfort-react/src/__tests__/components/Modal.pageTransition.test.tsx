import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routes } from '../../components/Openfort/types.js'

/**
 * The modal keeps at most two pages in the DOM: the active one and, for the
 * length of its exit animation, the one it replaced. Every other page must stay
 * unmounted so its hooks never run.
 */

let currentRoute: string = routes.PROVIDERS

// Stable identities: the modal treats a changed uiConfig as a re-measure trigger.
const uiConfig = {}
const connector = { id: '' }

vi.mock('../../components/Openfort/useOpenfort', () => ({
  useOpenfort: () => ({
    route: { route: currentRoute },
    connector,
    uiConfig,
    onBack: null,
    headerLeftSlot: null,
    resize: 0,
  }),
}))
vi.mock('../../components/ConnectKitThemeProvider/ConnectKitThemeProvider', () => ({
  useThemeContext: () => ({ theme: 'auto', mode: 'auto', customTheme: {} }),
}))
vi.mock('../../wallets/useExternalConnectors', () => ({ useExternalConnector: () => undefined }))
vi.mock('../../core/ConnectionStrategyContext', () => ({ useConnectionStrategy: () => null }))
vi.mock('../../ethereum/OpenfortEthereumBridgeContext', () => ({ useEthereumBridge: () => null }))
// FitText measures DOM sizes that jsdom cannot provide
vi.mock('../../components/Common/FitText', () => ({
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

  it('renders no page for a route that has none', async () => {
    renderModal(routes.PROVIDERS)
    await screen.findByText('providers page')

    render(<Modal open pages={pages} pageId="missingRoute" />)

    await waitFor(() => expect(screen.queryAllByText('providers page')).toHaveLength(1))
    expect(screen.queryByText('about page')).toBeNull()
  })
})
