import { expectTypeOf, test } from 'vitest'

import { type OpenfortError, type SignMessageResult, useSignMessage } from '../../index.js'

test('modal signing resolves a signature or typed error', () => {
  const signer = useSignMessage({
    onSuccess: (result) => expectTypeOf(result.signature).toEqualTypeOf<string>(),
    onError: (error) => expectTypeOf(error).toEqualTypeOf<OpenfortError>(),
  })

  expectTypeOf(signer.error).toEqualTypeOf<OpenfortError | null>()
  expectTypeOf(signer.signMessage).returns.resolves.toEqualTypeOf<SignMessageResult>()
  expectTypeOf(signer.signTypedData).returns.resolves.toEqualTypeOf<SignMessageResult>()
})
