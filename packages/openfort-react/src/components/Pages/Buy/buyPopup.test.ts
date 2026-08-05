import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeBuyPopup, navigateBuyPopup, reserveBuyPopup, takeBuyPopup } from './buyPopup'

const fakePopup = () => ({
  closed: false,
  close: vi.fn(function (this: { closed: boolean }) {
    this.closed = true
  }),
  document: { write: vi.fn(), close: vi.fn() },
  location: { href: '' },
})

const stubOpen = (result: unknown) => vi.spyOn(window, 'open').mockReturnValue(result as Window)

afterEach(() => {
  closeBuyPopup()
  vi.restoreAllMocks()
})

describe('reserveBuyPopup', () => {
  it('opens about:blank so the window is claimed inside the user gesture', () => {
    const popup = fakePopup()
    const open = stubOpen(popup)

    expect(reserveBuyPopup()).toBe(popup)
    expect(open).toHaveBeenCalledWith('', 'BuyPopup', expect.stringContaining('width=500'))
    // Empty URL: navigation happens later, once the onramp session resolves.
    expect(open.mock.calls[0][0]).toBe('')
  })

  it('returns null when the popup blocker refuses the window', () => {
    stubOpen(null)
    expect(reserveBuyPopup()).toBeNull()
    expect(takeBuyPopup()).toBeNull()
  })

  it('closes a previously reserved window instead of leaking it', () => {
    const first = fakePopup()
    stubOpen(first)
    reserveBuyPopup()

    stubOpen(fakePopup())
    reserveBuyPopup()

    expect(first.close).toHaveBeenCalled()
  })
})

describe('takeBuyPopup', () => {
  it('hands over the reserved window exactly once', () => {
    const popup = fakePopup()
    stubOpen(popup)
    reserveBuyPopup()

    expect(takeBuyPopup()).toBe(popup)
    expect(takeBuyPopup()).toBeNull()
  })

  it('discards a window the user already closed', () => {
    const popup = fakePopup()
    stubOpen(popup)
    reserveBuyPopup()
    popup.closed = true

    expect(takeBuyPopup()).toBeNull()
  })

  it('returns null when nothing was reserved', () => {
    expect(takeBuyPopup()).toBeNull()
  })
})

describe('navigateBuyPopup', () => {
  it('points the reserved window at the provider url', () => {
    const popup = fakePopup()
    expect(navigateBuyPopup(popup as unknown as Window, 'https://pay.coinbase.com/buy')).toBe(true)
    expect(popup.location.href).toBe('https://pay.coinbase.com/buy')
  })

  it('reports failure instead of throwing when the window is gone', () => {
    const popup = {
      get location(): Location {
        throw new Error('window closed')
      },
    }
    expect(navigateBuyPopup(popup as unknown as Window, 'https://pay.coinbase.com/buy')).toBe(false)
  })
})
