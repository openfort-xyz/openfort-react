'use client'

import React, { useMemo } from 'react'
import Logos from '../assets/logos.js'

import { useOpenfortConfig } from '../components/Openfort/useOpenfort.js'
import { OpenfortConfigError } from '../errors/config.js'
import { getLocale } from './../localizations/index.js'
import type { LocaleProps } from '../localizations/locales/index.js'
import { logger } from '../utils/logger.js'

/**
 * The hook's values, unlike the raw locale modules, are markdown-parsed into
 * React nodes. Typing them as `string` is what let a template literal print
 * `[object Object]` in the chain-switch alert.
 */
export type LocalizedText = { [K in keyof LocaleProps]: React.ReactNode }

export default function useLocales(replacements?: Record<string, string>): LocalizedText {
  const { uiConfig } = useOpenfortConfig()
  const language = uiConfig.language ?? 'en-US'

  const translations = useMemo(() => {
    return getLocale(language)
  }, [language])

  if (!translations) {
    logger.error(`Missing translations for: ${language}`)
    throw new OpenfortConfigError(`Missing translations for language "${language}".`)
  }

  const translated: Record<string, React.ReactNode> = {}
  Object.entries(translations).forEach(([key, string]) => {
    translated[key] = localize(string, replacements)
  })

  return translated as LocalizedText
}

const localize = (text: string, replacements?: Record<string, string>) => {
  let parsedText: string = text
  if (replacements) {
    Object.entries(replacements).forEach(([key, replacement]) => {
      // use `replace` instead of `replaceAll` to support Node 14
      parsedText = parsedText.replace(new RegExp(`({{ ${key} }})`, 'g'), replacement)
    })
  }
  return replaceMarkdown(parsedText)
}

const replaceMarkdown = (markdownText: string): React.ReactNode[] => {
  const lines = markdownText.split('\n')
  return lines.map((t, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: static markdown lines don't reorder
    <React.Fragment key={`line-${i}-${t.substring(0, 20)}`}>
      {wrapTags(t)}
      {i < lines.length - 1 && <br />}
    </React.Fragment>
  ))
}

const wrapTags = (text: string) => {
  // Bold markdown handling
  const textArray = text.split(/(\*\*[^*]*\*\*)/g)
  const result = textArray.map((str, i) => {
    if (/(\*\*.*\*\*)/g.test(str)) {
      // use `replace` instead of `replaceAll` to support Node 14
      // biome-ignore lint/suspicious/noArrayIndexKey: static markdown splits don't reorder
      return <strong key={`bold-${i}-${str.substring(0, 10)}`}>{str.replace(/\*\*/g, '')}</strong>
    }
    return `${str}`
  })

  // Replace text with logo
  return result.map((r) => {
    if (typeof r === 'string') {
      return r.split(/(\[WALLETCONNECTLOGO\])/g).map((s) => {
        if (s === '[WALLETCONNECTLOGO]') {
          return (
            <span key={s} className="ck-tt-logo">
              <Logos.WalletConnect />
            </span>
          )
        }
        return s
      })
    }
    return r
  })
}
