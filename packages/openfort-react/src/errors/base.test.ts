import { expect, test, vi } from 'vitest'

import { AuthenticationError, NotAuthenticatedError } from './auth.js'
import { asOpenfortError, OpenfortError, toError } from './base.js'
import {
  ChainNotConfiguredError,
  ClientNotInitializedError,
  OpenfortConfigError,
  RpcUrlNotConfiguredError,
  SolanaClusterNotSupportedError,
  WalletConfigNotFoundError,
} from './config.js'
import {
  ConnectorNotFoundError,
  ConnectorTypeMismatchError,
  ProviderNotFoundError,
  SiweMessageError,
} from './connection.js'
import { FundingError, FundingNotConfiguredError } from './funding.js'
import { ApiRequestError, UnsupportedOperationError } from './operation.js'
import { InvalidEmailError, MissingParameterError, ValidationError } from './validation.js'
import {
  OtpRequiredError,
  ProviderNotReadyError,
  RecoveryError,
  SetActiveWalletError,
  WalletCreationError,
  WalletError,
  WalletImportError,
  WalletNotConnectedError,
  WalletNotFoundError,
} from './wallet.js'

vi.mock('../version.js', () => ({ OPENFORT_VERSION: 'x.y.z' }))

test('composes a message from the short message and version footer', () => {
  expect(new OpenfortError('An error occurred.')).toMatchInlineSnapshot(`
    [OpenfortError: An error occurred.

    Version: @openfort/react@x.y.z]
  `)
})

test('falls back to a generic short message when given an empty one', () => {
  expect(new OpenfortError('', { details: 'details' })).toMatchInlineSnapshot(`
    [OpenfortError: An error occurred.

    Details: details
    Version: @openfort/react@x.y.z]
  `)
})

test('renders details, docs link and meta messages', () => {
  expect(
    new OpenfortError('An error occurred.', {
      details: 'details',
      docsPath: '/wallets/recovery',
      metaMessages: ['Reason: idk', 'Cause: lol'],
    })
  ).toMatchInlineSnapshot(`
    [OpenfortError: An error occurred.

    Reason: idk
    Cause: lol

    Docs: https://www.openfort.io/docs/wallets/recovery
    Details: details
    Version: @openfort/react@x.y.z]
  `)
})

test('keeps the outer short message when wrapping an OpenfortError', () => {
  const inner = new OpenfortError('The inner failure.', { details: 'inner details' })
  const outer = new OpenfortError('The outer failure.', { cause: inner })

  expect(outer.shortMessage).toBe('The outer failure.')
  expect(outer.message).toContain('The outer failure.')
  expect(outer.cause).toBe(inner)
  expect(outer).toMatchInlineSnapshot(`
    [OpenfortError: The outer failure.

    Details: inner details
    Version: @openfort/react@x.y.z]
  `)
})

test('inherits details and docsPath from an OpenfortError cause', () => {
  const inner = new OpenfortError('inner', { details: 'inner details', docsPath: '/docs' })
  const outer = new OpenfortError('outer', { cause: inner })

  expect(outer.details).toBe('inner details')
  expect(outer.docsPath).toBe('/docs')
})

test('prefers the cause docsPath over its own', () => {
  const inner = new OpenfortError('inner', { docsPath: '/from-cause' })
  expect(new OpenfortError('outer', { cause: inner, docsPath: '/own' }).docsPath).toBe('/from-cause')

  const plain = new OpenfortError('inner')
  expect(new OpenfortError('outer', { cause: plain, docsPath: '/own' }).docsPath).toBe('/own')
})

test('takes details from a plain Error cause message', () => {
  const outer = new OpenfortError('An internal error occurred.', { cause: new Error('details'), docsPath: '/lol' })

  expect(outer.details).toBe('details')
  expect(outer).toMatchInlineSnapshot(`
    [OpenfortError: An internal error occurred.

    Docs: https://www.openfort.io/docs/lol
    Details: details
    Version: @openfort/react@x.y.z]
  `)
})

test('walk returns the deepest cause without a predicate', () => {
  const leaf = new WalletError('leaf')
  const error = new OpenfortError('root', { cause: new AuthenticationError('middle', { cause: leaf }) })

  expect(error.walk()).toBe(leaf)
})

test('walk returns the first cause matching the predicate', () => {
  const middle = new AuthenticationError('middle', { cause: new WalletError('leaf') })
  const error = new OpenfortError('root', { cause: middle })

  expect(error.walk((err) => err instanceof AuthenticationError)).toBe(middle)
})

test('walk reaches plain Errors in the chain', () => {
  const leaf = new Error('leaf')
  const error = new OpenfortError('root', { cause: new WalletError('middle', { cause: leaf }) })

  expect(error.walk((err) => err instanceof Error && err.message === 'leaf')).toBe(leaf)
})

test('toError coerces non-Error rejections', () => {
  const error = new Error('already an error')
  expect(toError(error)).toBe(error)
  expect(toError('a string').message).toBe('a string')
  expect(toError({ code: 4001 }).message).toBe('{"code":4001}')
  expect(toError(4001n).message).toBe('4001n')
  expect(toError(undefined).message).toBe('undefined')

  const cyclic: { self?: unknown } = {}
  cyclic.self = cyclic
  expect(toError(cyclic).message).toBe('{"self":"[Circular]"}')
})

test('toError survives values whose serialization and string conversion both throw', () => {
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new Error('blocked property access')
      },
    }
  )

  expect(toError(hostile).message).toBe('Unknown thrown value')
})

test('asOpenfortError passes through Openfort errors and wraps everything else', () => {
  const typed = new WalletError('already typed')
  expect(asOpenfortError(typed, (cause) => new AuthenticationError('wrapped', { cause }))).toBe(typed)

  const wrapped = asOpenfortError('boom', (cause) => new AuthenticationError('wrapped', { cause }))
  expect(wrapped).toBeInstanceOf(AuthenticationError)
  expect(wrapped.cause).toBeInstanceOf(Error)
  expect(wrapped.details).toBe('boom')
})

test.each([
  [new OpenfortError('x'), 'OpenfortError', OpenfortError],
  [new AuthenticationError('x'), 'AuthenticationError', AuthenticationError],
  [new NotAuthenticatedError(), 'NotAuthenticatedError', AuthenticationError],
  [new OpenfortConfigError('x'), 'OpenfortConfigError', OpenfortConfigError],
  [new WalletConfigNotFoundError(), 'WalletConfigNotFoundError', OpenfortConfigError],
  [new ClientNotInitializedError(), 'ClientNotInitializedError', OpenfortConfigError],
  [new ChainNotConfiguredError({ chainId: 1 }), 'ChainNotConfiguredError', OpenfortConfigError],
  [new RpcUrlNotConfiguredError({ chainId: 1 }), 'RpcUrlNotConfiguredError', OpenfortConfigError],
  [new SolanaClusterNotSupportedError({ cluster: 'nope' }), 'SolanaClusterNotSupportedError', OpenfortConfigError],
  [new FundingNotConfiguredError(), 'FundingNotConfiguredError', OpenfortConfigError],
  [new ValidationError('x'), 'ValidationError', ValidationError],
  [new MissingParameterError({ params: ['email'] }), 'MissingParameterError', ValidationError],
  [new InvalidEmailError(), 'InvalidEmailError', ValidationError],
  [new WalletError('x'), 'WalletError', WalletError],
  [new WalletCreationError({ chain: 'Ethereum' }), 'WalletCreationError', WalletError],
  [new WalletImportError({ chain: 'Solana' }), 'WalletImportError', WalletError],
  [new SetActiveWalletError({ chain: 'Ethereum' }), 'SetActiveWalletError', WalletError],
  [new WalletNotFoundError(), 'WalletNotFoundError', WalletError],
  [new WalletNotConnectedError(), 'WalletNotConnectedError', WalletError],
  [new ProviderNotReadyError(), 'ProviderNotReadyError', WalletError],
  [new RecoveryError('x'), 'RecoveryError', WalletError],
  [new OtpRequiredError({ canRequestOtp: true }), 'OtpRequiredError', WalletError],
  [new ConnectorNotFoundError(), 'ConnectorNotFoundError', WalletError],
  [
    new ConnectorTypeMismatchError({ expected: 'oauth', received: 'injected' }),
    'ConnectorTypeMismatchError',
    WalletError,
  ],
  [new ProviderNotFoundError(), 'ProviderNotFoundError', WalletError],
  [new SiweMessageError(), 'SiweMessageError', WalletError],
  [new FundingError('x'), 'FundingError', OpenfortError],
  [new UnsupportedOperationError({ operation: 'x' }), 'UnsupportedOperationError', OpenfortError],
  [new ApiRequestError({ operation: 'x' }), 'ApiRequestError', OpenfortError],
])('%s reports its name and category base class', (error, name, base) => {
  expect(error).toBeInstanceOf(OpenfortError)
  expect(error.name).toBe(name)
  expect(error).toBeInstanceOf(base)
  expect(error.message).toContain('Version: @openfort/react@x.y.z')
})

test('MissingParameterError lists the parameters in the message', () => {
  expect(new MissingParameterError({ params: ['email'] }).shortMessage).toBe('`email` is required.')
  expect(new MissingParameterError({ params: ['email', 'otp'] }).shortMessage).toBe('`email` and `otp` are required.')
  expect(new MissingParameterError({ params: ['a', 'b', 'c'] }).shortMessage).toBe('`a`, `b` and `c` are required.')
})

test('ChainNotConfiguredError names the chain when it knows it', () => {
  expect(new ChainNotConfiguredError().shortMessage).toBe('No chain configured.')
  expect(new ChainNotConfiguredError({ chainId: 8453 }).shortMessage).toBe('Chain 8453 is not configured.')
  expect(new ChainNotConfiguredError({ chainId: 8453 }).metaMessages).toEqual([
    'Add the chain to the `chains` passed to your Wagmi config.',
  ])
})

test('ApiRequestError keeps the status and body reachable', () => {
  const error = new ApiRequestError({ operation: 'Funding request', status: 502, body: 'upstream exploded' })

  expect(error.status).toBe(502)
  expect(error.body).toBe('upstream exploded')
  expect(error.shortMessage).toBe('Funding request failed (502).')
  expect(error.details).toBe('upstream exploded')
})

test('OtpRequiredError only explains configuration when OTP cannot be requested', () => {
  expect(new OtpRequiredError({ canRequestOtp: true }).metaMessages).toBeUndefined()
  expect(new OtpRequiredError({ canRequestOtp: false }).metaMessages).toEqual([
    'Set `requestWalletRecoveryOTP` or `requestWalletRecoveryOTPEndpoint` in `OpenfortProvider`.',
  ])
})
