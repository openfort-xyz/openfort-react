import { ApiRequestError } from '../../errors/operation.js'

const RECOVERY_REQUEST_TIMEOUT_MS = 15_000

/** Sends a recovery HTTP request with a bounded wait and a typed timeout error. */
export async function fetchRecoveryRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  operation: string
): Promise<Response> {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(
        new ApiRequestError({
          operation,
          body: `Timed out after ${RECOVERY_REQUEST_TIMEOUT_MS}ms.`,
        })
      )
    }, RECOVERY_REQUEST_TIMEOUT_MS)
  })

  try {
    return await Promise.race([fetch(input, { ...init, signal: controller.signal }), timeout])
  } finally {
    clearTimeout(timeoutId)
  }
}
