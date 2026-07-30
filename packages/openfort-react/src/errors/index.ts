export {
  AuthenticationError,
  type AuthenticationErrorType,
  NotAuthenticatedError,
  type NotAuthenticatedErrorType,
} from './auth.js'
export {
  asOpenfortError,
  type ErrorType,
  OpenfortError,
  type OpenfortErrorOptions,
  type OpenfortErrorType,
  OpenfortReactErrorType,
  toError,
} from './base.js'
export {
  ChainNotConfiguredError,
  type ChainNotConfiguredErrorType,
  ClientNotInitializedError,
  type ClientNotInitializedErrorType,
  OpenfortConfigError,
  type OpenfortConfigErrorType,
  RpcUrlNotConfiguredError,
  type RpcUrlNotConfiguredErrorType,
  SolanaClusterNotSupportedError,
  type SolanaClusterNotSupportedErrorType,
  WalletConfigNotFoundError,
  type WalletConfigNotFoundErrorType,
} from './config.js'
export {
  ConnectorNotFoundError,
  type ConnectorNotFoundErrorType,
  ConnectorTypeMismatchError,
  type ConnectorTypeMismatchErrorType,
  ProviderNotFoundError,
  type ProviderNotFoundErrorType,
  SiweMessageError,
  type SiweMessageErrorType,
} from './connection.js'
export {
  FundingError,
  type FundingErrorType,
  FundingNotConfiguredError,
  type FundingNotConfiguredErrorType,
} from './funding.js'
export {
  ApiRequestError,
  type ApiRequestErrorType,
  UnsupportedOperationError,
  type UnsupportedOperationErrorType,
} from './operation.js'
export {
  InvalidEmailError,
  type InvalidEmailErrorType,
  MissingParameterError,
  type MissingParameterErrorType,
  ValidationError,
  type ValidationErrorType,
} from './validation.js'
export {
  OtpRequiredError,
  type OtpRequiredErrorType,
  ProviderNotReadyError,
  type ProviderNotReadyErrorType,
  RecoveryError,
  type RecoveryErrorType,
  SetActiveWalletError,
  type SetActiveWalletErrorType,
  type WalletChain,
  WalletCreationError,
  type WalletCreationErrorType,
  WalletError,
  type WalletErrorType,
  WalletImportError,
  type WalletImportErrorType,
  WalletNotConnectedError,
  type WalletNotConnectedErrorType,
  WalletNotFoundError,
  type WalletNotFoundErrorType,
} from './wallet.js'
