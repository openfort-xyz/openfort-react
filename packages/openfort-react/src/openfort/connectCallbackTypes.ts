import type { User } from '@openfort/openfort-js'

export type ConnectCallbackProps = {
  onConnect?: ({ address, connectorId, user }: { address?: string; connectorId?: string; user?: User }) => void
  onDisconnect?: () => void
}

export type useConnectCallbackProps = ConnectCallbackProps
