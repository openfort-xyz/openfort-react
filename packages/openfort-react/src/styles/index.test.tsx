import { renderToString } from 'react-dom/server'
import { ServerStyleSheet, StyleSheetManager } from 'styled-components'
import { describe, expect, it } from 'vitest'
import { ResetContainer, resolveTheme } from './index.js'

describe('resolveTheme', () => {
  it('resolves every container independently', () => {
    expect(resolveTheme('midnight').mode).toBe('dark')
    expect(resolveTheme('soft').mode).toBe('light')
    expect(resolveTheme(undefined, 'dark').mode).toBe('dark')
    expect(resolveTheme().mode).toBe('auto')
  })

  it('keeps globals scoped to each theme during an SSR render', () => {
    const sheet = new ServerStyleSheet()
    try {
      renderToString(
        <StyleSheetManager sheet={sheet.instance}>
          <div>
            <ResetContainer $useTheme="midnight" />
            <ResetContainer $useTheme="soft" />
          </div>
        </StyleSheetManager>
      )
      const styles = sheet.getStyleTags()
      expect(styles).toContain('--ck-graphic-scaniconwithlogos-01:#AFAFAF')
      expect(styles).toContain('--ck-graphic-scaniconwithlogos-01:#4E4E4E')
    } finally {
      sheet.seal()
    }
  })
})
