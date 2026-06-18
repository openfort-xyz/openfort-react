import { describe, expect, it } from 'vitest'
import { buildWalletSendLinks } from './walletSendLinks'

const EVM_NATIVE = 'ethereum:0xRecv@8453?value=1000000000000000'
const EVM_ERC20 = 'ethereum:0xToken@8453/transfer?address=0xRecv&uint256=1000000'
const SOLANA = 'solana:Recv111?spl-token=Mint111'

describe('buildWalletSendLinks', () => {
  it('returns [] when no address URI yet (no session)', () => {
    expect(buildWalletSendLinks(undefined, 'evm')).toEqual([])
  })

  it('lists only EVM wallet apps for an evm route', () => {
    const apps = buildWalletSendLinks(EVM_NATIVE, 'evm').map((l) => l.app)
    expect(apps).toEqual(['metamask', 'trust', 'rainbow', 'rabby', 'coinbase'])
    expect(apps).not.toContain('phantom')
  })

  it('lists only Phantom for an svm route', () => {
    expect(buildWalletSendLinks(SOLANA, 'svm').map((l) => l.app)).toEqual(['phantom'])
  })

  it('wraps the EIP-681 body in MetaMask’s send deeplink (scheme stripped)', () => {
    const mm = buildWalletSendLinks(EVM_NATIVE, 'evm').find((l) => l.app === 'metamask')
    expect(mm?.url).toBe('https://metamask.app.link/send/0xRecv@8453?value=1000000000000000')
  })

  it('passes the raw URI through for scheme-handling wallets', () => {
    const trust = buildWalletSendLinks(EVM_ERC20, 'evm').find((l) => l.app === 'trust')
    expect(trust?.url).toBe(EVM_ERC20)
  })

  it('defaults an unknown vmType to evm', () => {
    expect(buildWalletSendLinks(EVM_NATIVE, 'unknown').map((l) => l.app)).toContain('metamask')
  })
})
