import { Openfort as OpenfortClient, type OpenfortSDKConfiguration } from '@openfort/openfort-js'

const DEFAULT_BACKEND_URL = 'https://api.openfort.io'
let backendUrl = DEFAULT_BACKEND_URL

/** @internal */
export const getOpenfortBackendUrl = (): string => backendUrl

/**
 * Creates a new {@link OpenfortClient} instance.
 *
 * @param config - Configuration options passed directly to the Openfort SDK constructor.
 * @returns A configured Openfort client instance.
 *
 * @example
 * ```ts
 * const client = createOpenfortClient({
 *   baseConfiguration: { publishableKey: 'pk_test_123' },
 * });
 *
 * const token = await client.getAccessToken();
 * ```
 */
export function createOpenfortClient(config: OpenfortSDKConfiguration): OpenfortClient {
  backendUrl = config.overrides?.backendUrl ?? DEFAULT_BACKEND_URL
  return new OpenfortClient(config)
}
