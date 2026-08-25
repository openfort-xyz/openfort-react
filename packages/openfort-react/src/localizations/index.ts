import { default as arAE } from './locales/ar-AE.js'
import { default as caAD } from './locales/ca-AD.js'
import { default as eeEE } from './locales/ee-EE.js'
import { default as enUS } from './locales/en-US.js'
import { default as esES } from './locales/es-ES.js'
import { default as faIR } from './locales/fa-IR.js'
import { default as frFR } from './locales/fr-FR.js'
import { default as jaJP } from './locales/ja-JP.js'
import { default as ptBR } from './locales/pt-BR.js'
import { default as ruRU } from './locales/ru-RU.js'
import { default as trTR } from './locales/tr-TR.js'
import { default as viVN } from './locales/vi-VN.js'
import { default as zhCN } from './locales/zh-CN.js'

const locales = {
  'ar-AE': arAE,
  'ca-AD': caAD,
  'ee-EE': eeEE,
  'en-US': enUS,
  'es-ES': esES,
  'fa-IR': faIR,
  'fr-FR': frFR,
  'ja-JP': jaJP,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'tr-TR': trTR,
  'vi-VN': viVN,
  'zh-CN': zhCN,
}

export type Languages = keyof typeof locales

/** English is the fallback, so an unrecognised language still renders. */
export const getLocale = (lang: Languages) => locales[lang] ?? enUS
