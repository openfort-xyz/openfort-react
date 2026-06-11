import type React from 'react'
import type { OpenfortPlaygroundMode } from '@/providers'

const EthereumIcon = ({ className, size = 20 }: { className?: string; size?: number }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 44 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ background: '#25292E', borderRadius: 8 }}
  >
    <path d="M21.9967 6.99621L21.7955 7.67987V27.5163L21.9967 27.7171L31.2044 22.2744L21.9967 6.99621Z" fill="#fff" />
    <path d="M21.9957 6.99621L12.7878 22.2744L21.9957 27.7171V18.0891V6.99621Z" fill="#fff" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M21.9959 36.9996L21.9959 36.9997V36.9995L31.2091 24.0243L21.9959 29.4642L12.788 24.0243L21.9957 36.9993L21.9958 36.9997L21.9959 36.9996Z"
      fill="#fff"
    />
    <path d="M21.996 27.7181L31.2037 22.2753L21.996 18.09V27.7181Z" fill="#fff" />
    <path d="M12.7878 22.2753L21.9957 27.7181V18.09L12.7878 22.2753Z" fill="#fff" />
  </svg>
)

const SolanaIcon = ({ className, size = 20 }: { className?: string; size?: number }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 397 311"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
      fill="url(#solana-a)"
    />
    <path
      d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
      fill="url(#solana-b)"
    />
    <path
      d="M332.3 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H5.7c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
      fill="url(#solana-c)"
    />
    <defs>
      <linearGradient id="solana-a" x1="360.9" y1="351.5" x2="141.7" y2="-69.3" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
      <linearGradient id="solana-b" x1="264.1" y1="401.9" x2="44.9" y2="-18.9" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
      <linearGradient id="solana-c" x1="312.1" y1="377.2" x2="92.9" y2="-43.6" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00FFA3" />
        <stop offset="1" stopColor="#DC1FFF" />
      </linearGradient>
    </defs>
  </svg>
)

export const MODE_ICONS: Record<OpenfortPlaygroundMode, React.ReactNode> = {
  svm: <SolanaIcon size={18} />,
  evm: <EthereumIcon size={16} />,
}
