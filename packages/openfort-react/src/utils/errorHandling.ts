import {
  CallExecutionError,
  ChainDisconnectedError,
  ChainMismatchError,
  ChainNotFoundError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  EstimateGasExecutionError,
  ExecutionRevertedError,
  FeeCapTooHighError,
  FeeCapTooLowError,
  HttpRequestError,
  InsufficientFundsError,
  InternalRpcError,
  IntrinsicGasTooHighError,
  IntrinsicGasTooLowError,
  InvalidChainIdError,
  InvalidInputRpcError,
  InvalidParamsRpcError,
  InvalidRequestRpcError,
  LimitExceededRpcError,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError,
  NonceMaxValueError,
  NonceTooHighError,
  NonceTooLowError,
  ProviderDisconnectedError,
  RawContractError,
  ResourceNotFoundRpcError,
  ResourceUnavailableRpcError,
  RpcRequestError,
  SwitchChainError,
  TimeoutError,
  TipAboveFeeCapError,
  TransactionExecutionError,
  TransactionRejectedRpcError,
  TransactionTypeNotSupportedError,
  UnauthorizedProviderError,
  UnknownRpcError,
  UnsupportedProviderMethodError,
  UserRejectedRequestError,
  BaseError as ViemBaseError,
  WaitForTransactionReceiptTimeoutError,
  WebSocketRequestError,
} from 'viem'
import { OpenfortError } from '../errors/base.js'
import { ProviderNotFoundError } from '../errors/connection.js'
import { WalletNotConnectedError } from '../errors/wallet.js'

/** A failure translated into copy the transaction screens can render directly. */
export type TransactionErrorDetails = {
  title: string
  message: string
  action?: string
}

type ErrorClass = abstract new (...args: never[]) => Error

/**
 * True when `error`, or anything in its `cause` chain, is an instance of one of
 * `classes`.
 *
 * viem and the SDK both nest the original failure under `cause` — an RPC
 * rejection surfaces as a `TransactionExecutionError` wrapping a
 * `UserRejectedRequestError` — so only a walk of the whole chain classifies
 * reliably.
 */
function matches(error: unknown, classes: readonly ErrorClass[]): boolean {
  const is = (candidate: unknown) => classes.some((cls) => candidate instanceof cls)
  if (is(error)) return true
  if (error instanceof ViemBaseError) return error.walk(is) !== null
  if (error instanceof OpenfortError) return is(error.walk(is))
  return false
}

/** Ordered classification table: the first entry whose classes match wins. */
const RULES: readonly { classes: readonly ErrorClass[]; details: TransactionErrorDetails }[] = [
  {
    classes: [UserRejectedRequestError],
    details: { title: 'Transaction cancelled', message: 'You cancelled the transaction.' },
  },
  {
    classes: [InsufficientFundsError],
    details: {
      title: 'Insufficient funds',
      message: "You don't have enough ETH to pay for the gas fee.",
      action: 'Add more ETH to your wallet to cover the transaction fee.',
    },
  },
  {
    classes: [WalletNotConnectedError],
    details: {
      title: 'Wallet not connected',
      message: 'Your wallet is not connected.',
      action: 'Please connect your wallet and try again.',
    },
  },
  {
    classes: [ProviderNotFoundError],
    details: {
      title: 'Wallet not found',
      message: 'No wallet extension detected.',
      action: 'Please install a wallet extension and try again.',
    },
  },
  {
    classes: [ChainMismatchError, ChainNotFoundError, InvalidChainIdError],
    details: {
      title: 'Wrong network',
      message: 'Your wallet is connected to a different network.',
      action: 'Please switch to the correct network in your wallet.',
    },
  },
  {
    classes: [SwitchChainError],
    details: {
      title: 'Network switch failed',
      message: 'Unable to switch to the requested network.',
      action: 'Please manually switch networks in your wallet.',
    },
  },
  {
    classes: [EstimateGasExecutionError],
    details: {
      title: 'Transaction would fail',
      message: 'This transaction is likely to fail.',
      action: 'Please check the recipient address and amount, then try again.',
    },
  },
  {
    classes: [IntrinsicGasTooHighError, IntrinsicGasTooLowError],
    details: {
      title: 'Gas limit error',
      message: 'The gas limit for this transaction is incorrect.',
      action: 'Please try again or contact support.',
    },
  },
  {
    classes: [NonceTooLowError],
    details: {
      title: 'Transaction pending',
      message: 'A transaction is already pending.',
      action: 'Please wait for your pending transaction to complete.',
    },
  },
  {
    classes: [NonceTooHighError, NonceMaxValueError],
    details: {
      title: 'Transaction error',
      message: 'Transaction nonce is invalid.',
      action: 'Please refresh the page and try again.',
    },
  },
  {
    classes: [FeeCapTooLowError, TipAboveFeeCapError],
    details: {
      title: 'Gas fee too low',
      message: 'The gas fee is too low for this transaction.',
      action: 'Try again with a higher gas fee.',
    },
  },
  {
    classes: [FeeCapTooHighError],
    details: {
      title: 'Gas fee too high',
      message: 'The gas fee is unusually high.',
      action: 'Please check the fee and try again.',
    },
  },
  {
    classes: [TransactionTypeNotSupportedError],
    details: {
      title: 'Transaction not supported',
      message: 'This transaction type is not supported on this network.',
      action: 'Please try a different transaction method.',
    },
  },
  {
    classes: [WaitForTransactionReceiptTimeoutError, TimeoutError],
    details: {
      title: 'Transaction timeout',
      message: 'The transaction is taking longer than expected.',
      action: 'It may still be processing. Check your wallet or block explorer.',
    },
  },
  {
    classes: [ExecutionRevertedError],
    details: {
      title: 'Transaction failed',
      message: 'The transaction was rejected by the contract.',
      action: 'Please check the transaction details and try again.',
    },
  },
  {
    classes: [ContractFunctionZeroDataError],
    details: {
      title: 'Contract error',
      message: 'The contract returned no data.',
      action: 'This contract may not exist on this network.',
    },
  },
  {
    classes: [ContractFunctionExecutionError, ContractFunctionRevertedError, CallExecutionError, RawContractError],
    details: {
      title: 'Contract error',
      message: 'The contract rejected this transaction.',
      action: 'Please verify the transaction parameters and try again.',
    },
  },
  {
    classes: [ChainDisconnectedError, ProviderDisconnectedError],
    details: {
      title: 'Connection lost',
      message: 'Lost connection to the network.',
      action: 'Please check your internet connection and try again.',
    },
  },
  {
    classes: [InternalRpcError, UnknownRpcError],
    details: {
      title: 'Network error',
      message: 'The network encountered an internal error.',
      action: 'Please try again in a moment.',
    },
  },
  {
    classes: [MethodNotFoundRpcError, MethodNotSupportedRpcError, UnsupportedProviderMethodError],
    details: {
      title: 'Method not supported',
      message: 'This operation is not supported by the current network.',
      action: 'Try switching to a different RPC provider.',
    },
  },
  {
    classes: [InvalidInputRpcError, InvalidParamsRpcError, InvalidRequestRpcError],
    details: {
      title: 'Invalid request',
      message: 'The request contains invalid parameters.',
      action: 'Please check the transaction details and try again.',
    },
  },
  {
    classes: [TransactionRejectedRpcError],
    details: {
      title: 'Transaction rejected',
      message: 'The network rejected this transaction.',
      action: 'Please check the transaction details and try again.',
    },
  },
  {
    classes: [LimitExceededRpcError, ResourceNotFoundRpcError, ResourceUnavailableRpcError],
    details: {
      title: 'Network busy',
      message: 'The network is currently busy or unavailable.',
      action: 'Please wait a moment and try again.',
    },
  },
  {
    classes: [UnauthorizedProviderError],
    details: {
      title: 'Unauthorized',
      message: 'This action requires authorization.',
      action: 'Please connect your wallet and try again.',
    },
  },
  {
    classes: [HttpRequestError, WebSocketRequestError, RpcRequestError],
    details: {
      title: 'Network error',
      message: 'Unable to connect to the network.',
      action: 'Check your internet connection and try again.',
    },
  },
  {
    classes: [TransactionExecutionError],
    details: {
      title: 'Transaction failed',
      message: 'The transaction failed to execute.',
      action: 'Please check the transaction details and try again.',
    },
  },
]

/**
 * The send screens call `provider.request` on the EIP-1193 provider directly, so
 * a wallet's rejection never passes through viem and never becomes a
 * `UserRejectedRequestError`. EIP-1193 assigns these codes, which is the
 * structured signal to key on. Ordered lowest to highest for readability only.
 */
const PROVIDER_ERROR_CODES = new Map<number, TransactionErrorDetails>([
  // -32000 is the de-facto "server error" node code; wallets reuse it for gas failures.
  [
    -32000,
    {
      title: 'Transaction would fail',
      message: 'This transaction is likely to fail.',
      action: 'Please check the recipient address and amount, then try again.',
    },
  ],
  [-32603, { title: 'Network error', message: 'The network encountered an internal error.' }],
  [4001, { title: 'Transaction cancelled', message: 'You cancelled the transaction.' }],
  [
    4100,
    {
      title: 'Unauthorized',
      message: 'This action requires authorization.',
      action: 'Please connect your wallet and try again.',
    },
  ],
  [
    4200,
    {
      title: 'Method not supported',
      message: 'This operation is not supported by the current network.',
      action: 'Try switching to a different RPC provider.',
    },
  ],
  [
    4900,
    {
      title: 'Connection lost',
      message: 'Lost connection to the network.',
      action: 'Please check your internet connection and try again.',
    },
  ],
  [
    4901,
    {
      title: 'Wrong network',
      message: 'Your wallet is connected to a different network.',
      action: 'Please switch to the correct network in your wallet.',
    },
  ],
])

/**
 * Phrases matched on text because no class or code reaches this function for them.
 *
 * - Rejections: some wallets throw a bare `Error` for a declined prompt without
 *   the EIP-1193 code 4001, so the wording is the only signal left.
 * - Network: `fetch` rejects with a plain `TypeError` on a dropped connection,
 *   which carries neither a viem class nor an RPC code.
 */
const TEXT_RULES: readonly { pattern: RegExp; details: TransactionErrorDetails }[] = [
  {
    pattern: /user (rejected|denied|cancell?ed)|rejected the request|transaction was rejected/i,
    details: { title: 'Transaction cancelled', message: 'You cancelled the transaction.' },
  },
  {
    pattern: /failed to fetch|network ?error|networkerror when attempting/i,
    details: {
      title: 'Network error',
      message: 'Unable to connect to the network.',
      action: 'Check your internet connection and try again.',
    },
  },
]

/** Reads the EIP-1193 error code off `error` or the first cause that carries one. */
function providerErrorCode(error: unknown): number | undefined {
  let current: unknown = error
  for (let depth = 0; current != null && depth < 10; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'number' && PROVIDER_ERROR_CODES.has(code)) return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

/** True when `error` or any of its causes has a message matching `pattern`. */
function messageMatches(error: unknown, pattern: RegExp): boolean {
  let current: unknown = error
  for (let depth = 0; current != null && depth < 10; depth++) {
    if (current instanceof Error && pattern.test(current.message)) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

/**
 * Turns a transaction failure into user-facing copy.
 *
 * The raw message is never surfaced: RPC errors leak node internals and revert
 * data that mean nothing to the person who pressed "Send".
 */
export function parseTransactionError(error: unknown): TransactionErrorDetails {
  if (!error) {
    return { title: 'Transaction failed', message: 'An unknown error occurred.' }
  }

  for (const rule of RULES) {
    if (matches(error, rule.classes)) return rule.details
  }

  const code = providerErrorCode(error)
  if (code !== undefined) {
    const details = PROVIDER_ERROR_CODES.get(code)
    if (details) return details
  }

  for (const rule of TEXT_RULES) {
    if (messageMatches(error, rule.pattern)) return rule.details
  }

  return {
    title: 'Transaction failed',
    message: 'An error occurred while processing your transaction.',
    action: 'Please try again.',
  }
}
