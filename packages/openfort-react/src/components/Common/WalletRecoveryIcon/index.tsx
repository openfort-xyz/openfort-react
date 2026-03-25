import { RecoveryMethod } from '@openfort/openfort-js'
import { FingerPrintIcon, KeyIcon, LockIcon } from '../../../assets/icons'

export const RECOVERY_METHOD_LABEL: Record<RecoveryMethod, string> = {
  [RecoveryMethod.AUTOMATIC]: 'Automatic',
  [RecoveryMethod.PASSWORD]: 'Password',
  [RecoveryMethod.PASSKEY]: 'Passkey',
}

export const WalletRecoveryIcon = ({ recovery }: { recovery: RecoveryMethod | undefined }) => {
  switch (recovery) {
    case RecoveryMethod.PASSWORD:
      return <KeyIcon />
    case RecoveryMethod.PASSKEY:
      return <FingerPrintIcon />
    case RecoveryMethod.AUTOMATIC:
      return <LockIcon />
    default:
      return null
  }
}
