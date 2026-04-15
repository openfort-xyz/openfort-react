import { describe, expect, it } from 'vitest'
import { safeExternalHref, safeImageSrc } from '../../utils/urlSecurity'

describe('safeExternalHref', () => {
  it.each([
    ['https://example.com', true],
    ['http://example.com/path?q=1', true],
    ['mailto:user@example.com', true],
    ['/relative/path', true],
  ])('accepts %s', (url, _accepted) => {
    expect(safeExternalHref(url)).toBeDefined()
  })

  it.each([
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)'],
    ['  javascript:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['vbscript:msgbox(1)'],
    ['file:///etc/passwd'],
    [''],
    [null as unknown as string],
    [undefined as unknown as string],
    [{} as unknown as string],
  ])('rejects %s', (url) => {
    expect(safeExternalHref(url)).toBeUndefined()
  })
})

describe('safeImageSrc', () => {
  it('accepts http(s) image URLs', () => {
    expect(safeImageSrc('https://cdn.example.com/a.png')).toBeDefined()
  })

  it('accepts whitelisted data:image base64 URLs', () => {
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=='
    expect(safeImageSrc(png)).toBe(png)
  })

  it('rejects javascript: scheme', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBeUndefined()
  })

  it('rejects non-image data: URLs', () => {
    expect(safeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined()
  })
})
