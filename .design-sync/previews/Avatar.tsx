import { Avatar } from '@openfort/react'

// Wallet avatar: a deterministic gradient identicon derived from the address
// (falls back to an ENS image when one resolves on Ethereum mainnet). The
// gradient palette is seeded from the address, so different wallets get
// different colors.

const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

export const Default = () => <Avatar address={VITALIK} size={64} radius={64} />

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <Avatar address={VITALIK} size={24} radius={24} />
    <Avatar address={VITALIK} size={40} radius={40} />
    <Avatar address={VITALIK} size={56} radius={56} />
    <Avatar address={VITALIK} size={72} radius={72} />
  </div>
)

export const Gallery = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    {[
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
      '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    ].map((address) => (
      <Avatar key={address} address={address} size={48} radius={48} />
    ))}
  </div>
)

export const Squircle = () => <Avatar address={VITALIK} size={64} radius={16} />
