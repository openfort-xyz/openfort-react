export {
  AuthenticationError,
  NotAuthenticatedError,
} from './auth.js'
export {
  OpenfortError,
  type OpenfortErrorOptions,
  OpenfortReactErrorType,
} from './base.js'
export {
  ChainNotConfiguredError,
  ClientNotInitializedError,
  OpenfortConfigError,
  RpcUrlNotConfiguredError,
  SolanaClusterNotSupportedError,
  WalletConfigNotFoundError,
} from './config.js'
export {
  ConnectorNotFoundError,
  ConnectorTypeMismatchError,
  ProviderNotFoundError,
  SiweMessageError,
} from './connection.js'
export {
  FundingError,
  FundingNotConfiguredError,
} from './funding.js'
export {
  ApiRequestError,
  UnsupportedOperationError,
} from './operation.js'
export {
  InvalidEmailError,
  MissingParameterError,
  ValidationError,
} from './validation.js'
export {
  OtpRequiredError,
  ProviderNotReadyError,
  RecoveryError,
  SetActiveWalletError,
  type WalletChain,
  WalletCreationError,
  WalletError,
  WalletImportError,
  WalletNotConnectedError,
  WalletNotFoundError,
} from './wallet.js'
