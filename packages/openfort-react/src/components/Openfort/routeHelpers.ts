import { ChainTypeEnum } from '@openfort/openfort-js'
import type { EthereumUserWallet, SolanaUserWallet } from '../../hooks/openfort/walletTypes'
import { routes, type SetRouteOptions } from './types'

const recoverRouteRegistry: Record<
  ChainTypeEnum.EVM | ChainTypeEnum.SVM,
  (wallet: EthereumUserWallet | SolanaUserWallet) => SetRouteOptions
> = {
  [ChainTypeEnum.EVM]: (wallet) => ({ route: routes.RECOVER_WALLET, wallet: wallet as EthereumUserWallet }),
  [ChainTypeEnum.SVM]: (wallet) => ({ route: routes.SOL_RECOVER_WALLET, wallet: wallet as SolanaUserWallet }),
}

export function recoverRoute(chainType: ChainTypeEnum, wallet: EthereumUserWallet | SolanaUserWallet): SetRouteOptions {
  return recoverRouteRegistry[chainType](wallet)
}

const createRouteRegistry: Record<ChainTypeEnum.EVM | ChainTypeEnum.SVM, () => SetRouteOptions> = {
  [ChainTypeEnum.EVM]: () => routes.CREATE_WALLET,
  [ChainTypeEnum.SVM]: () => routes.SOL_CREATE_WALLET,
}

export function createRoute(chainType: ChainTypeEnum): SetRouteOptions {
  return createRouteRegistry[chainType]()
}
