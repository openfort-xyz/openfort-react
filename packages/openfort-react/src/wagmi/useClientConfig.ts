'use client'

import { useEffect, useState } from 'react'
import { logger } from '../utils/logger'

const DEFAULT_BACKEND_URL = 'https://api.openfort.io'

const cacheKey = (publishableKey: string) => `openfort.clientConfig.${publishableKey}`

/** Client-safe project configuration served from the Openfort dashboard. */
export type ClientConfig = {
  /** WalletConnect (Reown) project ID configured on the web3 (external wallet) provider. */
  walletConnectProjectId?: string
}

type ConfigListResponse = {
  data?: Array<{ provider: string; walletConnectProjectId?: string }>
}

function readCache(publishableKey: string): ClientConfig | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem(cacheKey(publishableKey))
    return raw ? (JSON.parse(raw) as ClientConfig) : undefined
  } catch {
    return undefined
  }
}

function writeCache(publishableKey: string, config: ClientConfig): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(cacheKey(publishableKey), JSON.stringify(config))
  } catch {
    // Ignore quota / private-mode / SSR write failures — the cache is an optimization.
  }
}

/**
 * Reads dashboard-driven client configuration for a project.
 *
 * Seeds synchronously from `localStorage` so repeat visits resolve with no delay, then
 * revalidates against `GET {backendUrl}/iam/v1/config?enabled=true` in the background.
 * On failure it degrades to the cached (or empty) config and logs a non-fatal warning —
 * it never blocks or throws, so a config-endpoint blip can't break the wallet UI.
 */
export function useClientConfig(publishableKey: string, backendUrl?: string): ClientConfig {
  const [config, setConfig] = useState<ClientConfig>(() => readCache(publishableKey) ?? {})

  useEffect(() => {
    if (!publishableKey) return
    const controller = new AbortController()
    const base = backendUrl || DEFAULT_BACKEND_URL

    fetch(`${base}/iam/v1/config?enabled=true`, {
      headers: { Authorization: `Bearer ${publishableKey}` },
      signal: controller.signal,
    })
      .then((res) =>
        res.ok ? (res.json() as Promise<ConfigListResponse>) : Promise.reject(new Error(`config ${res.status}`))
      )
      .then((body) => {
        const web3 = body.data?.find((p) => p.provider === 'web3')
        const next: ClientConfig = { walletConnectProjectId: web3?.walletConnectProjectId }
        setConfig(next)
        writeCache(publishableKey, next)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        logger.warn(
          '[@openfort/react] Could not load client config from the Openfort dashboard; continuing without it.',
          err
        )
      })

    return () => controller.abort()
  }, [publishableKey, backendUrl])

  return config
}
