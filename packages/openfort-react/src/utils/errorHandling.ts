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
type TransactionErrorDetails = {
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
export function matchesErrorClass(error: unknown, classes: readonly ErrorClass[]): boolean {
  const is = (candidate: unknown) => classes.some((cls) => candidate instanceof cls)
  if (is(error)) return true
  if (error instanceof ViemBaseError) return error.walk(is) !== null
  if (error instanceof OpenfortError) return is(error.walk(is))
  return false
}

/**
 * Every message the transaction screens can show. The class, provider-code and
 * text tables below all resolve to one of these, and several resolve to the same
 * one, so the copy lives here once.
 */
const COPY = {
  cancelled: { title: 'Transaction cancelled', message: 'You cancelled the transaction.' },
  insufficientFundsEth: {
    title: 'Insufficient funds',
    message: "You don't have enough ETH to pay for the gas fee.",
    action: 'Add more ETH to your wallet to cover the transaction fee.',
  },
  insufficientFundsNative: {
    title: 'Insufficient funds',
    message: "You don't have enough native token to pay the gas fee.",
    action: 'Add funds to your wallet to cover the transaction fee.',
  },
  walletNotConnected: {
    title: 'Wallet not connected',
    message: 'Your wallet is not connected.',
    action: 'Please connect your wallet and try again.',
  },
  walletNotFound: {
    title: 'Wallet not found',
    message: 'No wallet extension detected.',
    action: 'Please install a wallet extension and try again.',
  },
  wrongNetwork: {
    title: 'Wrong network',
    message: 'Your wallet is connected to a different network.',
    action: 'Please switch to the correct network in your wallet.',
  },
  switchFailed: {
    title: 'Network switch failed',
    message: 'Unable to switch to the requested network.',
    action: 'Please manually switch networks in your wallet.',
  },
  wouldFail: {
    title: 'Transaction would fail',
    message: 'This transaction is likely to fail.',
    action: 'Please check the recipient address and amount, then try again.',
  },
  gasLimit: {
    title: 'Gas limit error',
    message: 'The gas limit for this transaction is incorrect.',
    action: 'Please try again or contact support.',
  },
  gasLimitExceeded: {
    title: 'Gas limit error',
    message: 'The transaction needs more gas than its limit allowed.',
    action: 'Try again, or reduce what the transaction does.',
  },
  pending: {
    title: 'Transaction pending',
    message: 'A transaction is already pending.',
    action: 'Please wait for your pending transaction to complete.',
  },
  pendingEarlier: {
    title: 'Transaction pending',
    message: 'An earlier transaction from this wallet has not confirmed yet.',
    action: 'Wait for it to confirm, then try again.',
  },
  badNonce: {
    title: 'Transaction error',
    message: 'Transaction nonce is invalid.',
    action: 'Please refresh the page and try again.',
  },
  feeTooLow: {
    title: 'Gas fee too low',
    message: 'The gas fee is too low for this transaction.',
    action: 'Try again with a higher gas fee.',
  },
  feeBelowBase: {
    title: 'Gas fee too low',
    message: 'The gas fee is below what the network is currently accepting.',
    action: 'Try again to price the transaction at the current rate.',
  },
  feeTooHigh: {
    title: 'Gas fee too high',
    message: 'The gas fee is unusually high.',
    action: 'Please check the fee and try again.',
  },
  typeNotSupported: {
    title: 'Transaction not supported',
    message: 'This transaction type is not supported on this network.',
    action: 'Please try a different transaction method.',
  },
  timeout: {
    title: 'Transaction timeout',
    message: 'The transaction is taking longer than expected.',
    action: 'It may still be processing. Check your wallet or block explorer.',
  },
  reverted: {
    title: 'Transaction failed',
    message: 'The transaction was rejected by the contract.',
    action: 'Please check the transaction details and try again.',
  },
  revertedShort: {
    title: 'Transaction failed',
    message: 'The transaction was rejected by the contract.',
    action: 'Check the transaction details and try again.',
  },
  contractNoData: {
    title: 'Contract error',
    message: 'The contract returned no data.',
    action: 'This contract may not exist on this network.',
  },
  contractRejected: {
    title: 'Contract error',
    message: 'The contract rejected this transaction.',
    action: 'Please verify the transaction parameters and try again.',
  },
  disconnected: {
    title: 'Connection lost',
    message: 'Lost connection to the network.',
    action: 'Please check your internet connection and try again.',
  },
  internal: {
    title: 'Network error',
    message: 'The network encountered an internal error.',
    action: 'Please try again in a moment.',
  },
  methodNotSupported: {
    title: 'Method not supported',
    message: 'This operation is not supported by the current network.',
    action: 'Try switching to a different RPC provider.',
  },
  invalidRequest: {
    title: 'Invalid request',
    message: 'The request contains invalid parameters.',
    action: 'Please check the transaction details and try again.',
  },
  networkRejected: {
    title: 'Transaction rejected',
    message: 'The network rejected this transaction.',
    action: 'Please check the transaction details and try again.',
  },
  busy: {
    title: 'Network busy',
    message: 'The network is currently busy or unavailable.',
    action: 'Please wait a moment and try again.',
  },
  unauthorized: {
    title: 'Unauthorized',
    message: 'This action requires authorization.',
    action: 'Please connect your wallet and try again.',
  },
  unreachable: {
    title: 'Network error',
    message: 'Unable to connect to the network.',
    action: 'Check your internet connection and try again.',
  },
  executionFailed: {
    title: 'Transaction failed',
    message: 'The transaction failed to execute.',
    action: 'Please check the transaction details and try again.',
  },
} as const satisfies Record<string, TransactionErrorDetails>

/** Ordered classification table: the first entry whose classes match wins. */
const RULES: readonly { classes: readonly ErrorClass[]; details: TransactionErrorDetails }[] = [
  { classes: [UserRejectedRequestError], details: COPY.cancelled },
  { classes: [InsufficientFundsError], details: COPY.insufficientFundsEth },
  { classes: [WalletNotConnectedError], details: COPY.walletNotConnected },
  { classes: [ProviderNotFoundError], details: COPY.walletNotFound },
  { classes: [ChainMismatchError, ChainNotFoundError, InvalidChainIdError], details: COPY.wrongNetwork },
  { classes: [SwitchChainError], details: COPY.switchFailed },
  // Before EstimateGasExecutionError: viem wraps a revert during estimation as
  // EstimateGasExecutionError → … → ExecutionRevertedError, and the nested class
  // is the one that says why the transaction would fail.
  { classes: [ExecutionRevertedError], details: COPY.reverted },
  { classes: [EstimateGasExecutionError], details: COPY.wouldFail },
  { classes: [IntrinsicGasTooHighError, IntrinsicGasTooLowError], details: COPY.gasLimit },
  { classes: [NonceTooLowError], details: COPY.pending },
  { classes: [NonceTooHighError, NonceMaxValueError], details: COPY.badNonce },
  { classes: [FeeCapTooLowError, TipAboveFeeCapError], details: COPY.feeTooLow },
  { classes: [FeeCapTooHighError], details: COPY.feeTooHigh },
  { classes: [TransactionTypeNotSupportedError], details: COPY.typeNotSupported },
  { classes: [WaitForTransactionReceiptTimeoutError, TimeoutError], details: COPY.timeout },
  { classes: [ContractFunctionZeroDataError], details: COPY.contractNoData },
  {
    classes: [ContractFunctionExecutionError, ContractFunctionRevertedError, CallExecutionError, RawContractError],
    details: COPY.contractRejected,
  },
  { classes: [ChainDisconnectedError, ProviderDisconnectedError], details: COPY.disconnected },
  {
    classes: [MethodNotFoundRpcError, MethodNotSupportedRpcError, UnsupportedProviderMethodError],
    details: COPY.methodNotSupported,
  },
  { classes: [InvalidParamsRpcError, InvalidRequestRpcError], details: COPY.invalidRequest },
  { classes: [TransactionRejectedRpcError], details: COPY.networkRejected },
  {
    classes: [LimitExceededRpcError, ResourceNotFoundRpcError, ResourceUnavailableRpcError],
    details: COPY.busy,
  },
  { classes: [UnauthorizedProviderError], details: COPY.unauthorized },
  { classes: [HttpRequestError, WebSocketRequestError, RpcRequestError], details: COPY.unreachable },
]

/**
 * Catch-all wrapper classes, the class-shaped twins of
 * {@link AMBIGUOUS_PROVIDER_CODES}: viem converts `-32603` into
 * `InternalRpcError`, `-32000` into `InvalidInputRpcError`, an unmapped code
 * into `UnknownRpcError`, and wraps every send failure in
 * `TransactionExecutionError` — all before this module sees the error. The real
 * reason (a revert, a rejection, an out-of-gas) sits in the nested message, so
 * these classes are only consulted once the text rules have found nothing.
 */
const AMBIGUOUS_RULES: readonly { classes: readonly ErrorClass[]; details: TransactionErrorDetails }[] = [
  { classes: [InternalRpcError, UnknownRpcError], details: COPY.internal },
  { classes: [InvalidInputRpcError], details: COPY.invalidRequest },
  { classes: [TransactionExecutionError], details: COPY.executionFailed },
]

/**
 * The send screens call `provider.request` on the EIP-1193 provider directly, so
 * a wallet's rejection never passes through viem and never becomes a
 * `UserRejectedRequestError`. EIP-1193 assigns these codes, which is the
 * structured signal to key on. Ordered lowest to highest for readability only.
 */
const PROVIDER_ERROR_CODES = new Map<number, TransactionErrorDetails>([
  // -32000 is the de-facto "server error" node code; wallets reuse it for gas failures.
  [-32000, COPY.wouldFail],
  [-32003, COPY.revertedShort],
  [-32603, { title: COPY.internal.title, message: COPY.internal.message }],
  [4001, COPY.cancelled],
  [4100, COPY.unauthorized],
  [4200, COPY.methodNotSupported],
  [4900, COPY.disconnected],
  [4901, COPY.wrongNetwork],
])

/**
 * Codes that carry no classification of their own.
 *
 * openfort-js wraps every unrecognised provider failure as `-32603`, and nodes
 * reuse `-32000` as a generic server error, both putting the real reason in the
 * message instead. Consulting these before the text rules would report "Network
 * error" for an out-of-gas wallet, so they are only used once nothing more
 * specific has matched.
 */
const AMBIGUOUS_PROVIDER_CODES: ReadonlySet<number> = new Set([-32603, -32000])

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
    details: COPY.cancelled,
  },
  { pattern: /failed to fetch|network ?error|networkerror when attempting/i, details: COPY.unreachable },
  // Revert before insufficient-funds: a revert reason routinely mentions a
  // balance ("ERC20: transfer amount exceeds balance"), and telling that user to
  // top up gas would be wrong. The node-level gas failure carries no revert
  // wording, so it still reaches the rule below.
  {
    pattern: /execution reverted|transaction reverted|reverted with reason|transfer amount exceeds/i,
    details: COPY.revertedShort,
  },
  {
    pattern: /insufficient funds|doesn't have enough native token|exceeds the balance/i,
    details: COPY.insufficientFundsNative,
  },
  { pattern: /nonce too low|nonce conflict|transaction with this nonce|already known/i, details: COPY.pendingEarlier },
  {
    pattern: /replacement transaction underpriced|fee too low|max fee per gas less than block/i,
    details: COPY.feeBelowBase,
  },
  { pattern: /ran out of gas|out of gas|gas required exceeds|intrinsic gas too low/i, details: COPY.gasLimitExceeded },
]

/**
 * Yields `error` and everything nested under its `cause` or `data`, breadth
 * first. Cycles are skipped and the walk is capped, because a provider is free
 * to hand back a self-referential object.
 */
function* nestedErrors(error: unknown): Generator<Record<string, unknown>> {
  const queue: unknown[] = [error]
  const seen = new Set<unknown>()

  while (queue.length > 0 && seen.size < 20) {
    const current = queue.shift()
    if (current == null || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)

    yield current as Record<string, unknown>
    queue.push((current as { cause?: unknown }).cause, (current as { data?: unknown }).data)
  }
}

/**
 * Reads the most specific EIP-1193 code carried by `error` or anything nested
 * under its `cause` or `data`.
 *
 * A wrapper's own code is usually the vaguest one present: openfort-js stamps
 * `-32603` on the outside while the wallet's real `4001` sits in the cause, and
 * MetaMask nests the revert code under `data`. Returning the first code found
 * would surface the wrapper every time, so an ambiguous code is only used when
 * the whole chain offers nothing better.
 */
function providerErrorCode(error: unknown): number | undefined {
  let ambiguous: number | undefined

  for (const current of nestedErrors(error)) {
    const code = current.code
    if (typeof code === 'number' && PROVIDER_ERROR_CODES.has(code)) {
      if (!AMBIGUOUS_PROVIDER_CODES.has(code)) return code
      ambiguous ??= code
    }
  }

  return ambiguous
}

/**
 * True when `error`, or anything nested under its `cause` or `data`, carries a
 * message matching `pattern`.
 *
 * A JSON-RPC failure often arrives as a plain object rather than an `Error`, so
 * matching only `Error` instances would skip the very payloads these rules
 * exist to classify.
 */
function messageMatches(error: unknown, pattern: RegExp): boolean {
  for (const current of nestedErrors(error)) {
    if (typeof current.message === 'string' && pattern.test(current.message)) return true
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
    if (matchesErrorClass(error, rule.classes)) return rule.details
  }

  const code = providerErrorCode(error)
  if (code !== undefined && !AMBIGUOUS_PROVIDER_CODES.has(code)) {
    const details = PROVIDER_ERROR_CODES.get(code)
    if (details) return details
  }

  for (const rule of TEXT_RULES) {
    if (messageMatches(error, rule.pattern)) return rule.details
  }

  // Nothing more specific matched, so fall back to what the catch-all says.
  for (const rule of AMBIGUOUS_RULES) {
    if (matchesErrorClass(error, rule.classes)) return rule.details
  }
  if (code !== undefined) {
    const details = PROVIDER_ERROR_CODES.get(code)
    if (details) return details
  }

  return {
    title: 'Transaction failed',
    message: 'An error occurred while processing your transaction.',
    action: 'Please try again.',
  }
}
