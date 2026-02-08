import api from './api';

// Types

/**
 * Rewards balance response
 */
export interface RewardsBalanceResponse {
  points: number;
  earnedToDate: number;
  redeemedToDate: number;
  currencyValue: number; // in cents
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextTierPoints: number;
  pointsToNextTier: number;
  expiresAt?: Date; // Earliest expiration date
  expiringPoints?: number; // Points that will expire soon
}

/**
 * Points history entry
 */
export interface PointsHistoryEntry {
  id: string;
  points: number;
  type: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  description: string;
  merchantName?: string;
  transactionId?: string;
  redemptionId?: string;
  createdAt: Date;
  expiresAt?: Date;
  balanceAfter: number;
}

/**
 * Points history response with pagination
 */
export interface PointsHistoryResponse {
  entries: PointsHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Reward offer
 */
export interface RewardOffer {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  discountValue: number; // in cents
  discountType: 'fixed' | 'percentage';
  percentage?: number; // For percentage discounts
  imageUrl?: string;
  terms: string[];
  expiresAt?: Date;
  isAvailable: boolean;
  category?: 'food' | 'shopping' | 'entertainment' | 'travel' | 'other';
}

/**
 * Available offers response
 */
export interface AvailableOffersResponse {
  offers: RewardOffer[];
  userPoints: number;
}

/**
 * Redeem points request
 */
export interface RedeemPointsRequest {
  offerId: string;
  points: number;
}

/**
 * Redeem points response
 */
export interface RedeemPointsResponse {
  redemptionId: string;
  discountCode: string;
  discountValue: number; // in cents
  newBalance: number;
  expiresAt: Date;
  terms: string[];
}

/**
 * Apply discount to payment request
 */
export interface ApplyDiscountRequest {
  redemptionId: string;
  transactionId: string;
  amount: number; // in cents
}

/**
 * Apply discount response
 */
export interface ApplyDiscountResponse {
  discountedAmount: number;
  savings: number;
  newBalance: number;
}

// API Functions

/**
 * Fetch rewards balance
 */
export const fetchRewardsBalance = async (): Promise<RewardsBalanceResponse> => {
  const response = await api.get<RewardsBalanceResponse>('/rewards/balance');
  return response.data;
};

/**
 * Fetch points history with pagination
 */
export const fetchPointsHistory = async (params?: {
  page?: number;
  pageSize?: number;
  type?: PointsHistoryEntry['type'];
  startDate?: string;
  endDate?: string;
}): Promise<PointsHistoryResponse> => {
  const response = await api.get<PointsHistoryResponse>('/rewards/history', {
    params: {
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
      type: params?.type,
      startDate: params?.startDate,
      endDate: params?.endDate,
    },
  });
  return response.data;
};

/**
 * Fetch available reward offers
 */
export const fetchAvailableOffers = async (): Promise<AvailableOffersResponse> => {
  const response = await api.get<AvailableOffersResponse>('/rewards/offers');
  return response.data;
};

/**
 * Redeem points for a reward
 */
export const redeemPoints = async (
  request: RedeemPointsRequest
): Promise<RedeemPointsResponse> => {
  const response = await api.post<RedeemPointsResponse>(
    '/rewards/redeem',
    request
  );
  return response.data;
};

/**
 * Apply a discount code to a payment
 */
export const applyDiscount = async (
  request: ApplyDiscountRequest
): Promise<ApplyDiscountResponse> => {
  const response = await api.post<ApplyDiscountResponse>(
    '/rewards/apply-discount',
    request
  );
  return response.data;
};

/**
 * Get points earned from a transaction (after payment)
 */
export const getTransactionPoints = async (
  transactionId: string
): Promise<{ points: number; newBalance: number }> => {
  const response = await api.get<{ points: number; newBalance: number }>(
    `/rewards/transaction/${transactionId}/points`
  );
  return response.data;
};

// Rewards API object
export const rewardsApi = {
  fetchRewardsBalance,
  fetchPointsHistory,
  fetchAvailableOffers,
  redeemPoints,
  applyDiscount,
  getTransactionPoints,
};

export default rewardsApi;
