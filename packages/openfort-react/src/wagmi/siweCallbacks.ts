import { toError } from '../errors/base.js'
import { notifyHookCallback } from '../hooks/openfort/hookConsistency.js'

/** Maps SIWE failures to the current consumer-facing message. */
export function getSiweErrorMessage(error: unknown, chainName: string | undefined): string {
  const message = toError(error).message
  if (message.includes('User rejected the request.')) return 'User rejected the request.'
  if (message.includes('Invalid signature')) return 'Invalid signature. Please try again.'
  if (message.includes('An error occurred when attempting to switch chain')) {
    return `Failed to switch chain. Please switch your wallet to ${chainName ?? 'the correct network'} and try again.`
  }
  if (message.includes('already linked')) {
    return 'This wallet is already linked to another account. Log out and connect with this wallet instead.'
  }
  return 'Failed to connect with SIWE.'
}

/** Adapts zero- and multi-argument SIWE callbacks to the shared hook callback boundary. */
export function notifySiweCallback<TArgs extends unknown[]>(
  callback: ((...args: TArgs) => unknown) | undefined,
  callbackName: 'onSuccess' | 'onError',
  ...args: TArgs
): void {
  notifyHookCallback(callback ? () => callback(...args) : undefined, undefined, callbackName)
}
