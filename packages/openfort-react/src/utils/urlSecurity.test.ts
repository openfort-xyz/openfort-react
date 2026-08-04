import { beforeEach, describe, expect, it } from 'vitest'
import { suppressReferrer } from './urlSecurity.js'

describe('suppressReferrer', () => {
  beforeEach(() => {
    document.head.querySelectorAll('meta[name="referrer"]').forEach((meta) => {
      meta.remove()
    })
  })

  it('keeps suppression active until every caller restores it', () => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'strict-origin'
    document.head.appendChild(meta)

    const restoreFirst = suppressReferrer()
    const restoreSecond = suppressReferrer()
    restoreFirst()

    expect(meta.content).toBe('no-referrer')

    restoreSecond()

    expect(meta.content).toBe('strict-origin')
  })

  it('does not overwrite a policy changed by the host while suppression is active', () => {
    const meta = document.createElement('meta')
    meta.name = 'referrer'
    meta.content = 'strict-origin'
    document.head.appendChild(meta)
    const restore = suppressReferrer()

    meta.content = 'same-origin'
    restore()

    expect(meta.content).toBe('same-origin')
  })
})
