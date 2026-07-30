import {
  ChainMismatchError,
  ContractFunctionRevertedError,
  ExecutionRevertedError,
  HttpRequestError,
  InsufficientFundsError,
  InternalRpcError,
  MethodNotSupportedRpcError,
  NonceTooLowError,
  RpcRequestError,
  SwitchChainError,
  TransactionExecutionError,
  UserRejectedRequestError,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import { mainnet, optimism } from 'viem/chains'
import { describe, expect, test } from 'vitest'
import { OpenfortError } from '../errors/base.js'
import { ProviderNotFoundError } from '../errors/connection.js'
import { WalletNotConnectedError } from '../errors/wallet.js'
import { parseTransactionError } from './errorHandling.js'

const rpcError = { code: -32603, message: 'boom' }

describe('viem errors', () => {
  test.each([
    [new UserRejectedRequestError(new Error('denied')), 'Transaction cancelled'],
    [new InsufficientFundsError({ cause: new Error('no funds') }), 'Insufficient funds'],
    [new ChainMismatchError({ chain: optimism, currentChainId: mainnet.id }), 'Wrong network'],
    [new SwitchChainError(new Error('nope')), 'Network switch failed'],
    [new NonceTooLowError({ cause: new Error('nonce') }), 'Transaction pending'],
    [new ExecutionRevertedError({ cause: new Error('reverted') }), 'Transaction failed'],
    [new InternalRpcError(rpcError), 'Network error'],
    [new MethodNotSupportedRpcError(rpcError), 'Method not supported'],
    [new WaitForTransactionReceiptTimeoutError({ hash: '0xdead' }), 'Transaction timeout'],
    [new HttpRequestError({ url: 'https://rpc.example' }), 'Network error'],
    [new RpcRequestError({ body: {}, error: rpcError, url: 'https://rpc.example' }), 'Network error'],
  ])('classifies %s', (error, title) => {
    expect(parseTransactionError(error).title).toBe(title)
  })

  test('never surfaces the raw message to the user', () => {
    const details = parseTransactionError(new InternalRpcError(rpcError))

    expect(details.message).not.toContain('boom')
    expect(details.message).not.toContain('-32603')
  })
})

describe('cause chains', () => {
  test('finds a rejection nested under a viem execution error', () => {
    const error = new TransactionExecutionError(new UserRejectedRequestError(new Error('denied')), {})

    expect(parseTransactionError(error).title).toBe('Transaction cancelled')
  })

  test('finds a viem error nested under an OpenfortError', () => {
    const error = new OpenfortError('Failed to send the transaction.', {
      cause: new InsufficientFundsError({ cause: new Error('no funds') }),
    })

    expect(parseTransactionError(error).title).toBe('Insufficient funds')
  })

  test('finds a viem error two OpenfortError levels deep', () => {
    const inner = new OpenfortError('inner', { cause: new UserRejectedRequestError(new Error('denied')) })
    const error = new OpenfortError('outer', { cause: inner })

    expect(parseTransactionError(error).title).toBe('Transaction cancelled')
  })

  test('prefers the more specific rejection over the wrapping execution error', () => {
    const specific = new TransactionExecutionError(new UserRejectedRequestError(new Error('denied')), {})
    const generic = new TransactionExecutionError(new Error('something else'), {})

    expect(parseTransactionError(specific).title).toBe('Transaction cancelled')
    expect(parseTransactionError(generic).title).toBe('Transaction failed')
  })
})

describe('Openfort errors', () => {
  test.each([
    [new WalletNotConnectedError(), 'Wallet not connected'],
    [new ProviderNotFoundError(), 'Wallet not found'],
  ])('classifies %s', (error, title) => {
    expect(parseTransactionError(error).title).toBe(title)
  })
})

describe('raw EIP-1193 provider errors', () => {
  /** The send screens call `provider.request` directly, so these never reach viem. */
  const providerError = (code: number, message = 'provider says no') => Object.assign(new Error(message), { code })

  test.each([
    [4001, 'Transaction cancelled'],
    [4100, 'Unauthorized'],
    [4200, 'Method not supported'],
    [4900, 'Connection lost'],
    [4901, 'Wrong network'],
    [-32603, 'Network error'],
    [-32000, 'Transaction would fail'],
  ])('classifies code %i', (code, title) => {
    expect(parseTransactionError(providerError(code)).title).toBe(title)
  })

  test('reads the code off a nested cause', () => {
    const error = new Error('wrapper', { cause: providerError(4001) })

    expect(parseTransactionError(error).title).toBe('Transaction cancelled')
  })

  test('classifies a rejection that carries no code, by wording', () => {
    expect(parseTransactionError(new Error('User rejected the request.')).title).toBe('Transaction cancelled')
    expect(parseTransactionError(new Error('User denied transaction signature.')).title).toBe('Transaction cancelled')
  })

  test('ignores an unmodelled numeric code', () => {
    expect(parseTransactionError(providerError(1234)).title).toBe('Transaction failed')
  })
})

describe('fallbacks', () => {
  test('reports an unknown error for a nullish input', () => {
    expect(parseTransactionError(null)).toEqual({
      title: 'Transaction failed',
      message: 'An unknown error occurred.',
    })
  })

  test('classifies a bare fetch failure as a network error', () => {
    expect(parseTransactionError(new TypeError('Failed to fetch')).title).toBe('Network error')
  })

  test('falls back to a generic failure for an unrecognised error', () => {
    const details = parseTransactionError(new Error('something nobody modelled'))

    expect(details.title).toBe('Transaction failed')
    expect(details.message).toBe('An error occurred while processing your transaction.')
    expect(details.message).not.toContain('nobody modelled')
  })

  test('does not classify a contract revert as a cancellation', () => {
    const error = new ContractFunctionRevertedError({ abi: [], functionName: 'transfer' })

    expect(parseTransactionError(error).title).toBe('Contract error')
  })
})
