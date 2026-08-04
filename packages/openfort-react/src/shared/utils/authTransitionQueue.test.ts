import type { Openfort } from '@openfort/openfort-js'
import { describe, expect, it, vi } from 'vitest'
import { captureAuthSession, reserveAuthenticatedMutation, reserveAuthTransition } from './authTransitionQueue.js'

describe('reserveAuthTransition', () => {
  it('reserves latest ownership synchronously and runs credential mutations in order', async () => {
    const client = {} as Openfort
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const order: string[] = []

    const first = reserveAuthTransition(client, async () => {
      order.push('first:start')
      await firstGate
      order.push('first:end')
      return 'first'
    })
    await Promise.resolve()

    const secondMutation = vi.fn(async () => {
      order.push('second')
      return 'second'
    })
    const second = reserveAuthTransition(client, secondMutation)

    expect(first.isCurrent()).toBe(false)
    expect(second.isCurrent()).toBe(true)
    expect(secondMutation).not.toHaveBeenCalled()

    releaseFirst()
    await expect(first.result).resolves.toBe('first')
    await expect(second.result).resolves.toBe('second')
    expect(order).toEqual(['first:start', 'first:end', 'second'])
  })

  it('continues the queue after a credential mutation rejects', async () => {
    const client = {} as Openfort
    const first = reserveAuthTransition(client, async () => {
      throw new Error('rejected credentials')
    })
    const secondMutation = vi.fn(async () => 'authenticated')
    const second = reserveAuthTransition(client, secondMutation)

    await expect(first.result).rejects.toThrow('rejected credentials')
    await expect(second.result).resolves.toBe('authenticated')
    expect(secondMutation).toHaveBeenCalledOnce()
  })

  it('serializes an authenticated mutation before logout while transferring ownership immediately', async () => {
    const client = {} as Openfort
    let releaseLink!: () => void
    const linkGate = new Promise<void>((resolve) => {
      releaseLink = resolve
    })
    const order: string[] = []
    const session = captureAuthSession(client)
    const link = reserveAuthenticatedMutation(client, async () => {
      order.push('link:start')
      await linkGate
      order.push('link:end')
    })
    await Promise.resolve()

    const logout = reserveAuthTransition(client, async () => {
      order.push('logout')
    })

    expect(session.isCurrent()).toBe(false)
    expect(link.isCurrent()).toBe(false)
    releaseLink()
    await Promise.all([link.result, logout.result])
    expect(order).toEqual(['link:start', 'link:end', 'logout'])
    expect(logout.isCurrent()).toBe(true)
  })
})
