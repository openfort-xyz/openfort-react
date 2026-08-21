import { expectTypeOf, test } from 'vitest'

import type { OpenfortError } from '../../types.js'
import { type SolanaAsset, type UseSolanaWalletAssetsResult, useSolanaWalletAssets } from '../index.js'

test('Solana wallet assets expose typed data and errors from the public entry point', () => {
  const result = useSolanaWalletAssets()

  expectTypeOf(result).toEqualTypeOf<UseSolanaWalletAssetsResult>()
  expectTypeOf(result.data).toEqualTypeOf<SolanaAsset[] | null>()
  expectTypeOf(result.error).toEqualTypeOf<OpenfortError | undefined>()
})
