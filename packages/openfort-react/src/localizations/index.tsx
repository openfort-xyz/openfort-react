export type Languages =
  | 'ar-AE'
  | 'en-US'
  | 'ee-EE'
  | 'es-ES'
  | 'fa-IR'
  | 'fr-FR'
  | 'ja-JP'
  | 'pt-BR'
  | 'zh-CN'
  | 'ca-AD'
  | 'ru-RU'
  | 'zh-CN'
  | 'tr-TR'
  | 'vi-VN'

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

// TODO: Load locales on demand so bundlers can drop the unused ones. This
// switch statically imports all thirteen.
export const getLocale = (lang: Languages) => {
  switch (lang) {
    case 'ee-EE':
      return eeEE
    case 'ar-AE':
      return arAE
    case 'es-ES':
      return esES
    case 'fa-IR':
      return faIR
    case 'fr-FR':
      return frFR
    case 'ja-JP':
      return jaJP
    case 'pt-BR':
      return ptBR
    case 'ru-RU':
      return ruRU
    case 'zh-CN':
      return zhCN
    case 'ca-AD':
      return caAD
    case 'tr-TR':
      return trTR
    case 'vi-VN':
      return viVN
    default:
      return enUS
  }
}

/*
// Could be useful for locale files to use these keys rather than hard-coded into the objects
export const keys = {
  connectorName: '{{ CONNECTORNAME }}',
  connectorShortName: '{{ CONNECTORSHORTNAME }}',
  suggestedExtensionBrowser: '{{ SUGGESTEDEXTENSIONBROWSER }}',
  walletConnectLogo: '{{ WALLETCONNECTLOGO }}',
};
*/
