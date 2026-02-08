export { default as api, setNavigationRef } from './api';
export { authApi } from './auth.api';
export { walletApi } from './wallet.api';
export { rewardsApi } from './rewards.api';

export type {
  WalletBalance,
  TransactionsResponse,
  TransactionDetails,
  TransactionMetadata,
  FundWalletRequest,
  FundWalletResponse,
  WithdrawRequest,
  WithdrawResponse,
  FundingMethodsResponse,
  AddPaymentMethodRequest,
  AddPaymentMethodResponse,
  DeletePaymentMethodResponse,
  SetDefaultPaymentMethodResponse,
} from './wallet.api';

export type {
  RewardsBalanceResponse,
  PointsHistoryEntry,
  PointsHistoryResponse,
  RewardOffer,
  AvailableOffersResponse,
  RedeemPointsRequest,
  RedeemPointsResponse,
  ApplyDiscountRequest,
  ApplyDiscountResponse,
} from './rewards.api';
