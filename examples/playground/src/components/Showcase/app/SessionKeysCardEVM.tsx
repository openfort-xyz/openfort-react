import { useGrantPermissions, useRevokePermissions } from '@openfort/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { getAddress } from 'viem/utils'
import { useEthereumAccount } from '@/hooks/useEthereumAdapterHooks'
import { useIsSessionKeySupported } from '@/hooks/useIsSessionKeySupported'
import { getMintContractAddress } from '@/lib/contracts'
import { type StoredData, useSessionKeysStorage_backendSimulation } from '@/lib/useSessionKeysStorage'
import {
  SessionKeyListItem,
  SessionKeyMessages,
  SessionKeysCardShell,
  SessionKeysCreateButton,
} from './session-keys-shared'

export const SessionKeysCardEVM = ({ hook }: { hook?: string }) => {
  const { grantPermissions, isLoading, error } = useGrantPermissions()
  const { revokePermissions, isLoading: isRevoking, error: revokeError } = useRevokePermissions()
  const [sessionKeys, setSessionKeys] = useState<StoredData[]>([])
  const [submitting, setSubmitting] = useState(false)
  const { addPrivateKey, getPrivateKeys, clearAll, removePrivateKey, updatePrivateKey } =
    useSessionKeysStorage_backendSimulation()
  const { address, chainId } = useEthereumAccount()
  const isSessionKeySupported = useIsSessionKeySupported()
  const mintContractAddress = getMintContractAddress(chainId ?? undefined)
  const key = useMemo(() => (chainId != null && address ? `${chainId}-${address}` : ''), [chainId, address])
  const grantDisabled = isLoading || submitting || !mintContractAddress || !isSessionKeySupported
  const isCreating = submitting || isLoading

  const updateSessionKeys = useCallback(() => {
    const keys = getPrivateKeys(key)
    if (typeof keys[0] === 'string') {
      clearAll()
      window.location.reload()
      return
    }
    setSessionKeys(getPrivateKeys(key))
  }, [key, getPrivateKeys, clearAll])

  useEffect(() => {
    updateSessionKeys()
  }, [updateSessionKeys])

  return (
    <SessionKeysCardShell hook={hook}>
      <form
        className="space-y-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (grantDisabled) return
          setSubmitting(true)
          try {
            const privateKey = generatePrivateKey()
            const accountSessionAddress = privateKeyToAccount(privateKey).address
            const { error: grantError, permissionsContext } = await grantPermissions({
              sessionKey: privateKey,
              request: {
                signer: {
                  type: 'account',
                  data: {
                    id: accountSessionAddress,
                  },
                },
                expiry: 60 * 60 * 24,
                permissions: [
                  {
                    type: 'contract-call',
                    data: {
                      address: getAddress(mintContractAddress!),
                      calls: [],
                    },
                    policies: [],
                  },
                ],
              },
            })
            if (!grantError && permissionsContext) {
              addPrivateKey(key, {
                privateKey: privateKey,
                publicKey: accountSessionAddress,
                sessionKeyId: permissionsContext,
                active: true,
              })
              setTimeout(updateSessionKeys, 100)
            }
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <SessionKeysCreateButton
          isCreating={isCreating}
          disabled={grantDisabled}
          isSessionKeySupported={isSessionKeySupported}
        />
        {sessionKeys.map((item) => (
          <SessionKeyListItem
            key={item.privateKey}
            item={item}
            storageKey={key}
            onRevoke={async (publicKey) => {
              const result = await revokePermissions({ sessionKey: publicKey })
              return { error: result.error }
            }}
            onRemove={(sessionKeyId) => removePrivateKey(key, sessionKeyId)}
            onUpdate={(k, d) => updatePrivateKey(k, d)}
            onRefresh={updateSessionKeys}
          />
        ))}
        <SessionKeyMessages error={error} revokeError={revokeError} isRevoking={isRevoking} />
      </form>
    </SessionKeysCardShell>
  )
}
