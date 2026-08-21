import { expectTypeOf, test } from 'vitest'

import { type FundingPayLinkResult, type FundingSessionResult, type OpenfortError, useFunding } from '../../index.js'

test('funding actions resolve typed result unions', () => {
  const funding = useFunding({
    onError: (error) => expectTypeOf(error).toEqualTypeOf<OpenfortError>(),
  })

  expectTypeOf(funding.error).toEqualTypeOf<OpenfortError | null>()
  expectTypeOf(funding.fund).returns.resolves.toEqualTypeOf<FundingSessionResult>()
  expectTypeOf(funding.createSession).returns.resolves.toEqualTypeOf<FundingSessionResult>()
  expectTypeOf(funding.track).returns.resolves.toEqualTypeOf<FundingSessionResult>()
  expectTypeOf(funding.payLink).returns.resolves.toEqualTypeOf<FundingPayLinkResult>()
})
