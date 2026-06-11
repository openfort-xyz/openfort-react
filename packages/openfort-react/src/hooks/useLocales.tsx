'use client'

import React, { useMemo } from 'react'
import Logos from '../assets/logos'

import { useOpenfort } from '../components/Openfort/useOpenfort'

import { getLocale } from './../localizations'
import type { LocaleProps } from '../localizations/locales'
import { logger } from '../utils/logger'

export default function useLocales(replacements?: Record<string, string>): LocaleProps {
  const context = useOpenfort()
  const language = context.uiConfig.language ?? 'en-US'

  const translations = useMemo(() => {
    return getLocale(language)
  }, [language])

  if (!translations) {
    logger.error(`Missing translations for: ${language}`)
    throw new Error(`Missing translations for: ${language}`)
  }

  const translated: Record<string, unknown> = {}
  Object.keys(translations).forEach((key) => {
    const string = translations[key]
    translated[key] = localize(string, replacements)
  })

  return translated as LocaleProps
}

const localize = (text: string, replacements?: Record<string, string>) => {
  let parsedText: string = text
  if (replacements) {
    Object.keys(replacements).forEach((key) => {
      // use `replace` instead of `replaceAll` to support Node 14
      parsedText = parsedText.replace(new RegExp(`({{ ${key} }})`, 'g'), replacements[key as keyof typeof replacements])
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
