import { ChainIcon } from '@openfort/react'

// Chain icon: renders a network's logo by its EVM chain id. Shows a loading
// spinner when no id is given and an "unsupported network" warning badge when
// the chain isn't in the configured set.

export const Default = () => <ChainIcon id={1} unsupported={false} size={48} />

export const Gallery = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    {[1, 10, 137, 42161, 8453, 7777777].map((id) => (
      <ChainIcon key={id} id={id} unsupported={false} size={40} />
    ))}
  </div>
)

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    <ChainIcon id={1} unsupported={false} size={24} />
    <ChainIcon id={1} unsupported={false} size={36} />
    <ChainIcon id={1} unsupported={false} size={48} />
  </div>
)

export const Unsupported = () => <ChainIcon id={1} unsupported size={48} />
