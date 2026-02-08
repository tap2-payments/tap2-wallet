import { create } from 'zustand';
import type {
  RewardsBalanceResponse,
  PointsHistoryEntry,
  RewardOffer,
  RedeemPointsRequest,
  RedeemPointsResponse,
} from '@/services/rewards.api';
import * as rewardsApi from '@/services/rewards.api';

interface RewardsState {
  // Balance state
  points: number;
  earnedToDate: number;
  redeemedToDate: number;
  currencyValue: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextTierPoints: number;
  pointsToNextTier: number;
  expiresAt?: Date;
  expiringPoints?: number;

  // History state
  historyEntries: PointsHistoryEntry[];
  historyPage: number;
  historyHasMore: boolean;
  historyTotal: number;

  // Offers state
  offers: RewardOffer[];

  // Loading states
  isLoadingBalance: boolean;
  isLoadingHistory: boolean;
  isLoadingOffers: boolean;
  isRedeeming: boolean;

  // Error states
  balanceError: string | null;
  historyError: string | null;
  offersError: string | null;
  redeemError: string | null;

  // Recent redemption (for showing success screen)
  recentRedemption: RedeemPointsResponse | null;

  // Actions
  fetchBalance: () => Promise<void>;
  fetchHistory: (params?: {
    page?: number;
    pageSize?: number;
    type?: PointsHistoryEntry['type'];
    refresh?: boolean;
  }) => Promise<void>;
  fetchMoreHistory: () => Promise<void>;
  fetchOffers: () => Promise<void>;
  redeemPoints: (request: RedeemPointsRequest) => Promise<RedeemPointsResponse>;
  clearRecentRedemption: () => void;
  refreshAfterPayment: (transactionId: string) => Promise<void>;
  clearErrors: () => void;
}

export const useRewardsStore = create<RewardsState>((set, get) => ({
  // Initial state
  points: 0,
  earnedToDate: 0,
  redeemedToDate: 0,
  currencyValue: 0,
  tier: 'bronze',
  nextTierPoints: 100,
  pointsToNextTier: 100,
  expiresAt: undefined,
  expiringPoints: undefined,

  historyEntries: [],
  historyPage: 1,
  historyHasMore: true,
  historyTotal: 0,

  offers: [],

  isLoadingBalance: false,
  isLoadingHistory: false,
  isLoadingOffers: false,
  isRedeeming: false,

  balanceError: null,
  historyError: null,
  offersError: null,
  redeemError: null,

  recentRedemption: null,

  // Clear recent redemption
  clearRecentRedemption: () => set({ recentRedemption: null }),

  // Clear errors
  clearErrors: () =>
    set({
      balanceError: null,
      historyError: null,
      offersError: null,
      redeemError: null,
    }),

  // Fetch balance
  fetchBalance: async () => {
    set({ isLoadingBalance: true, balanceError: null });
    try {
      const response = await rewardsApi.fetchRewardsBalance();
      set({
        points: response.points,
        earnedToDate: response.earnedToDate,
        redeemedToDate: response.redeemedToDate,
        currencyValue: response.currencyValue,
        tier: response.tier,
        nextTierPoints: response.nextTierPoints,
        pointsToNextTier: response.pointsToNextTier,
        expiresAt: response.expiresAt,
        expiringPoints: response.expiringPoints,
        isLoadingBalance: false,
      });
    } catch (error) {
      set({
        balanceError:
          error instanceof Error ? error.message : 'Failed to fetch rewards balance',
        isLoadingBalance: false,
      });
      throw error;
    }
  },

  // Fetch history
  fetchHistory: async (params) => {
    const { refresh, type, page = 1, pageSize = 20 } = params || {};

    if (refresh) {
      set({
        historyEntries: [],
        historyPage: 1,
        historyHasMore: true,
        historyTotal: 0,
      });
    }

    set({ isLoadingHistory: true, historyError: null });
    try {
      const response = await rewardsApi.fetchPointsHistory({
        page,
        pageSize,
        type,
      });

      set((state) => ({
        historyEntries:
          refresh || page === 1
            ? response.entries
            : [...state.historyEntries, ...response.entries],
        historyPage: page,
        historyHasMore: response.hasMore,
        historyTotal: response.total,
        isLoadingHistory: false,
      }));
    } catch (error) {
      set({
        historyError:
          error instanceof Error ? error.message : 'Failed to fetch points history',
        isLoadingHistory: false,
      });
      throw error;
    }
  },

  // Fetch more history (pagination)
  fetchMoreHistory: async () => {
    const { historyPage, historyHasMore, isLoadingHistory } = get();

    if (!historyHasMore || isLoadingHistory) {
      return;
    }

    set({ isLoadingHistory: true });
    try {
      const response = await rewardsApi.fetchPointsHistory({
        page: historyPage + 1,
        pageSize: 20,
      });

      set((state) => ({
        historyEntries: [...state.historyEntries, ...response.entries],
        historyPage: state.historyPage + 1,
        historyHasMore: response.hasMore,
        isLoadingHistory: false,
      }));
    } catch (error) {
      set({
        historyError:
          error instanceof Error ? error.message : 'Failed to fetch points history',
        isLoadingHistory: false,
      });
      throw error;
    }
  },

  // Fetch offers
  fetchOffers: async () => {
    set({ isLoadingOffers: true, offersError: null });
    try {
      const response = await rewardsApi.fetchAvailableOffers();
      set({
        offers: response.offers,
        isLoadingOffers: false,
      });
    } catch (error) {
      set({
        offersError:
          error instanceof Error ? error.message : 'Failed to fetch available offers',
        isLoadingOffers: false,
      });
      throw error;
    }
  },

  // Redeem points
  redeemPoints: async (request) => {
    set({ isRedeeming: true, redeemError: null });
    try {
      const response = await rewardsApi.redeemPoints(request);

      // Update balance
      set((state) => ({
        points: response.newBalance,
        redeemedToDate: state.redeemedToDate + request.points,
        recentRedemption: response,
        isRedeeming: false,
      }));

      // Refresh balance from server
      await get().fetchBalance();

      return response;
    } catch (error) {
      set({
        redeemError:
          error instanceof Error ? error.message : 'Failed to redeem points',
        isRedeeming: false,
      });
      throw error;
    }
  },

  // Refresh after payment (get points earned)
  refreshAfterPayment: async (transactionId) => {
    try {
      const response = await rewardsApi.getTransactionPoints(transactionId);

      set((state) => ({
        points: response.newBalance,
        earnedToDate: state.earnedToDate + response.points,
      }));

      // Refresh full balance
      await get().fetchBalance();
    } catch (error) {
      console.error('Failed to refresh rewards after payment:', error);
    }
  },
}));
