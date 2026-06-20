import { describe, expect, it } from 'vitest'
import { buildDepositPageUrl, buildOpenDappLinks, caipToChainId } from './walletDeeplinks'

const PAGE = 'https://app.example.com/deposit.html'
const PARAMS = {
  vm: 'evm' as const,
  to: '0xCb1cC9ddb3FF9532F9cF6cf7365327EeA52d68b3',
  chainId: 42161,
  token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  decimals: 6,
  symbol: 'USDC',
  chain: 'Arbitrum',
}

describe('caipToChainId', () => {
  it('extracts the numeric reference', () => {
    expect(caipToChainId('eip155:8453')).toBe(8453)
    expect(caipToChainId('eip155:42161')).toBe(42161)
  })

  it('returns undefined for non-numeric or missing input', () => {
    expect(caipToChainId(undefined)).toBeUndefined()
    expect(caipToChainId('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBeUndefined()
  })
})

describe('buildDepositPageUrl', () => {
  it('encodes the transfer params as query string', () => {
    const url = new URL(buildDepositPageUrl(PAGE, PARAMS))
    expect(url.origin + url.pathname).toBe(PAGE)
    expect(url.searchParams.get('vm')).toBe('evm')
    expect(url.searchParams.get('to')).toBe(PARAMS.to)
    expect(url.searchParams.get('chainId')).toBe('42161')
    expect(url.searchParams.get('token')).toBe(PARAMS.token)
    expect(url.searchParams.get('decimals')).toBe('6')
    expect(url.searchParams.get('symbol')).toBe('USDC')
    expect(url.searchParams.get('chain')).toBe('Arbitrum')
  })

  it('builds a Solana (svm) request with no numeric chainId', () => {
    const url = new URL(
      buildDepositPageUrl(PAGE, {
        vm: 'svm',
        to: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        token: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        symbol: 'USDC',
        chain: 'Solana',
      })
    )
    expect(url.searchParams.get('vm')).toBe('svm')
    expect(url.searchParams.has('chainId')).toBe(false)
    expect(url.searchParams.get('to')).toBe('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
    expect(url.searchParams.get('token')).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  })

  it('omits token for a native asset and amount when not given', () => {
    const url = new URL(buildDepositPageUrl(PAGE, { ...PARAMS, token: undefined }))
    expect(url.searchParams.has('token')).toBe(false)
    expect(url.searchParams.has('amount')).toBe(false)
  })

  it('includes a preset amount when provided', () => {
    const url = new URL(buildDepositPageUrl(PAGE, { ...PARAMS, amount: '1000000' }))
    expect(url.searchParams.get('amount')).toBe('1000000')
  })
})

describe('buildOpenDappLinks', () => {
  it('returns the EVM wallets (including multichain Phantom) wrapping the encoded page url', () => {
    const links = buildOpenDappLinks(PAGE, 'evm')
    expect(links.map((l) => l.app)).toEqual(['metamask', 'coinbase', 'trust', 'rainbow', 'rabby', 'phantom'])
  })

  it('returns only Phantom for SVM', () => {
    const links = buildOpenDappLinks(PAGE, 'svm')
    expect(links.map((l) => l.app)).toEqual(['phantom'])
  })

  it('uses each wallet’s verified open-dApp universal link format', () => {
    const by = Object.fromEntries(buildOpenDappLinks(PAGE, 'evm').map((l) => [l.app, l.url]))
    const enc = encodeURIComponent(PAGE)
    // MetaMask strips the https:// scheme and appends host+path verbatim.
    expect(by.metamask).toBe('https://link.metamask.io/dapp/app.example.com/deposit.html')
    expect(by.coinbase).toBe(`https://go.cb-w.com/dapp?cb_url=${enc}`)
    expect(by.trust).toBe(`https://link.trustwallet.com/open_url?coin_id=60&url=${enc}`)
    expect(by.rainbow).toBe(`https://rainbow.me/dapp?url=${enc}`)
    expect(by.rabby).toBe(`https://go.rabby.io/mobile/?_cmd=open-dapp&dapp=${enc}`)
  })

  it('wraps the page url in Phantom’s browse link with a ref origin', () => {
    const [phantom] = buildOpenDappLinks(PAGE, 'svm')
    expect(phantom.url).toBe(
      `https://phantom.app/ul/browse/${encodeURIComponent(PAGE)}?ref=${encodeURIComponent('https://app.example.com')}`
    )
  })
})
