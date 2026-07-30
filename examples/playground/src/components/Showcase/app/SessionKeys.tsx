import { embeddedWalletId, useGrantPermissions, useRevokePermissions } from '@openfort/react'
import { useCallback, useEffect, useState } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { getAddress } from 'viem/utils'
import { useAccount, useSignMessage } from 'wagmi'
import { useConnectedEthereumAccount } from '@/hooks/useConnectedEthereumAccount'
import { useIsSessionKeySupported } from '@/hooks/useIsSessionKeySupported'
import { getMintContractAddress } from '@/lib/contracts'
import { type StoredData, useSessionKeysStorage_backendSimulation } from '@/lib/useSessionKeysStorage'
import {
  SessionKeyListItem,
  SessionKeyMessages,
  SessionKeysCardShell,
  SessionKeysCreateButton,
} from './session-keys-shared'

export const SessionKeysCard = ({ hook }: { hook?: string }) => {
  const { address, chainId } = useConnectedEthereumAccount()
  const { connector } = useAccount()
  const isSessionKeySupported = useIsSessionKeySupported()
  const { grantPermissions, isLoading, error } = useGrantPermissions()
  const { revokePermissions, isLoading: isRevoking, error: revokeError } = useRevokePermissions()
  const [sessionKeys, setSessionKeys] = useState<StoredData[]>([])
  const { addPrivateKey, getPrivateKeys, clearAll, removePrivateKey, updatePrivateKey } =
    useSessionKeysStorage_backendSimulation()
  const { data } = useSignMessage()
  const mintContractAddress = getMintContractAddress(chainId ?? undefined)
  const isExternalWallet = !!connector && connector.id !== embeddedWalletId
  const grantDisabled = isLoading || !mintContractAddress || !address || !isSessionKeySupported || isExternalWallet
  const key = `${chainId}-${address ?? ''}`

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
          const privateKey = generatePrivateKey()
          const accountSessionAddress = privateKeyToAccount(privateKey).address
          const { error, permissionsContext } = await grantPermissions({
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
          if (!error && permissionsContext) {
            addPrivateKey(key, {
              privateKey: privateKey,
              publicKey: accountSessionAddress,
              sessionKeyId: permissionsContext,
              active: true,
            })
            setTimeout(updateSessionKeys, 100)
          }
        }}
      >
        <SessionKeysCreateButton
          isCreating={isLoading}
          disabled={grantDisabled}
          isSessionKeySupported={isSessionKeySupported}
          isExternalWallet={isExternalWallet}
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
        <SessionKeyMessages
          error={error}
          revokeError={revokeError}
          isRevoking={isRevoking}
          signedData={data ?? undefined}
        />
      </form>
    </SessionKeysCardShell>
  )
}
