import { expectTypeOf, test } from 'vitest'

import type { OpenfortError } from '../../types.js'
import {
  type SignAuthorizationResult,
  type SignAuthorizationReturnType,
  use7702Authorization,
} from './use7702Authorization.js'

test('accepts hook-level callbacks and exposes mutation state', () => {
  const hook = use7702Authorization({
    onSuccess: (result) => {
      expectTypeOf(result.status).toEqualTypeOf<'success'>()
      expectTypeOf(result.authorization).toEqualTypeOf<SignAuthorizationReturnType>()
    },
    onError: (error) => {
      expectTypeOf(error).toEqualTypeOf<OpenfortError>()
    },
  })

  expectTypeOf(hook.data).toEqualTypeOf<SignAuthorizationReturnType | null>()
  expectTypeOf(hook.isLoading).toEqualTypeOf<boolean>()
  expectTypeOf(hook.isError).toEqualTypeOf<boolean>()
  expectTypeOf(hook.isSuccess).toEqualTypeOf<boolean>()
  expectTypeOf(hook.error).toEqualTypeOf<OpenfortError | null | undefined>()
})

test('resolves a discriminated authorization or typed error result', () => {
  const { signAuthorization } = use7702Authorization()
  const request = signAuthorization(
    {
      contractAddress: '0x1111111111111111111111111111111111111111',
      chainId: 8453,
      nonce: 1,
    },
    {
      hashMessage: false,
      arrayifyMessage: false,
      onSuccess: (result) => {
        expectTypeOf(result.status).toEqualTypeOf<'success'>()
      },
      onError: (error) => {
        expectTypeOf(error).toEqualTypeOf<OpenfortError>()
      },
    }
  )

  expectTypeOf(request).toEqualTypeOf<Promise<SignAuthorizationResult>>()
})
