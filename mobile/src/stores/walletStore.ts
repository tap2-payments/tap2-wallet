import { create } from 'zustand';
import type { Transaction } from '@/types';
import type { PaymentMethod } from '@/components/wallet';
import * as walletApi from '@/services/wallet.api';
import type {
  WalletBalance,
  TransactionsResponse,
  FundWalletRequest,
  WithdrawRequest,
  AddPaymentMethodRequest,
} from '@/services/wallet.api';

interface WalletState {
  // Balance state
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  currency: string;

  // Transactions state
  transactions: Transaction[];
  transactionsPage: number;
  transactionsHasMore: boolean;
  transactionsTotal: number;
  currentFilter: Transaction['type'] | 'all' | null;

  // Funding methods state
  fundingMethods: PaymentMethod[];
  defaultFundingMethodId: string | null;

  // Loading states
  isLoadingBalance: boolean;
  isLoadingTransactions: boolean;
  isLoadingFundingMethods: boolean;
  isFunding: boolean;
  isWithdrawing: boolean;
  isAddingPaymentMethod: boolean;

  // Error states
  balanceError: string | null;
  transactionsError: string | null;
  fundingMethodsError: string | null;

  // UI state
  balanceVisible: boolean;

  // Actions
  setBalanceVisible: (visible: boolean) => void;
  setCurrentFilter: (filter: Transaction['type'] | 'all' | null) => void;

  // API actions
  fetchBalance: () => Promise<void>;
  fetchTransactions: (params?: {
    page?: number;
    pageSize?: number;
    type?: Transaction['type'] | 'all';
    refresh?: boolean;
  }) => Promise<void>;
  fetchMoreTransactions: () => Promise<void>;
  fetchFundingMethods: () => Promise<void>;
  fundWallet: (request: FundWalletRequest) => Promise<void>;
  withdraw: (request: WithdrawRequest) => Promise<void>;
  addPaymentMethod: (request: AddPaymentMethodRequest) => Promise<void>;
  deletePaymentMethod: (methodId: string) => Promise<void>;
  setDefaultPaymentMethod: (methodId: string) => Promise<void>;

  // Internal actions
  resetTransactions: () => void;
  clearErrors: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  balance: 0,
  availableBalance: 0,
  pendingBalance: 0,
  currency: 'USD',

  transactions: [],
  transactionsPage: 1,
  transactionsHasMore: true,
  transactionsTotal: 0,
  currentFilter: null,

  fundingMethods: [],
  defaultFundingMethodId: null,

  isLoadingBalance: false,
  isLoadingTransactions: false,
  isLoadingFundingMethods: false,
  isFunding: false,
  isWithdrawing: false,
  isAddingPaymentMethod: false,

  balanceError: null,
  transactionsError: null,
  fundingMethodsError: null,

  balanceVisible: true,

  // UI actions
  setBalanceVisible: (visible) => set({ balanceVisible: visible }),

  setCurrentFilter: (filter) => set({ currentFilter: filter }),

  // Reset transactions
  resetTransactions: () =>
    set({
      transactions: [],
      transactionsPage: 1,
      transactionsHasMore: true,
      transactionsTotal: 0,
      transactionsError: null,
    }),

  // Clear errors
  clearErrors: () =>
    set({
      balanceError: null,
      transactionsError: null,
      fundingMethodsError: null,
    }),

  // Fetch balance
  fetchBalance: async () => {
    set({ isLoadingBalance: true, balanceError: null });
    try {
      const response = await walletApi.fetchBalance();
      set({
        balance: response.balance,
        availableBalance: response.availableBalance,
        pendingBalance: response.pendingBalance,
        currency: response.currency,
        isLoadingBalance: false,
      });
    } catch (error) {
      set({
        balanceError:
          error instanceof Error ? error.message : 'Failed to fetch balance',
        isLoadingBalance: false,
      });
      throw error;
    }
  },

  // Fetch transactions
  fetchTransactions: async (params) => {
    const { refresh, type, page = 1, pageSize = 20 } = params || {};

    if (refresh) {
      get().resetTransactions();
    }

    set({ isLoadingTransactions: true, transactionsError: null });
    try {
      const response = await walletApi.fetchTransactions({
        page,
        pageSize,
        type: type || get().currentFilter || undefined,
      });

      if (refresh || page === 1) {
        set({
          transactions: response.transactions,
          transactionsPage: 1,
        });
      } else {
        set((state) => ({
          transactions: [...state.transactions, ...response.transactions],
          transactionsPage: page,
        }));
      }

      set({
        transactionsHasMore: response.hasMore,
        transactionsTotal: response.total,
        isLoadingTransactions: false,
      });
    } catch (error) {
      set({
        transactionsError:
          error instanceof Error ? error.message : 'Failed to fetch transactions',
        isLoadingTransactions: false,
      });
      throw error;
    }
  },

  // Fetch more transactions (pagination)
  fetchMoreTransactions: async () => {
    const { transactionsPage, transactionsHasMore, isLoadingTransactions } =
      get();

    if (!transactionsHasMore || isLoadingTransactions) {
      return;
    }

    set({ isLoadingTransactions: true });
    try {
      const response = await walletApi.fetchTransactions({
        page: transactionsPage + 1,
        pageSize: 20,
        type: get().currentFilter || undefined,
      });

      set((state) => ({
        transactions: [...state.transactions, ...response.transactions],
        transactionsPage: state.transactionsPage + 1,
        transactionsHasMore: response.hasMore,
        isLoadingTransactions: false,
      }));
    } catch (error) {
      set({
        transactionsError:
          error instanceof Error ? error.message : 'Failed to fetch transactions',
        isLoadingTransactions: false,
      });
      throw error;
    }
  },

  // Fetch funding methods
  fetchFundingMethods: async () => {
    set({ isLoadingFundingMethods: true, fundingMethodsError: null });
    try {
      const response = await walletApi.fetchFundingMethods();
      set({
        fundingMethods: response.methods,
        defaultFundingMethodId: response.defaultMethodId || null,
        isLoadingFundingMethods: false,
      });
    } catch (error) {
      set({
        fundingMethodsError:
          error instanceof Error ? error.message : 'Failed to fetch payment methods',
        isLoadingFundingMethods: false,
      });
      throw error;
    }
  },

  // Fund wallet
  fundWallet: async (request) => {
    set({ isFunding: true });
    try {
      const response = await walletApi.fundWallet(request);

      // Update balance
      set({
        balance: response.newBalance,
        isFunding: false,
      });

      // Add transaction to the list
      set((state) => ({
        transactions: [response.transaction, ...state.transactions],
      }));

      // Refresh balance from server
      await get().fetchBalance();
    } catch (error) {
      set({ isFunding: false });
      throw error;
    }
  },

  // Withdraw
  withdraw: async (request) => {
    set({ isWithdrawing: true });
    try {
      const response = await walletApi.withdraw(request);

      // Update balance
      set({
        balance: response.newBalance,
        isWithdrawing: false,
      });

      // Add transaction to the list
      set((state) => ({
        transactions: [response.transaction, ...state.transactions],
      }));

      // Refresh balance from server
      await get().fetchBalance();
    } catch (error) {
      set({ isWithdrawing: false });
      throw error;
    }
  },

  // Add payment method
  addPaymentMethod: async (request) => {
    set({ isAddingPaymentMethod: true });
    try {
      const response = await walletApi.addPaymentMethod(request);

      set((state) => ({
        fundingMethods: [...state.fundingMethods, response.method],
        isAddingPaymentMethod: false,
      }));

      return response;
    } catch (error) {
      set({ isAddingPaymentMethod: false });
      throw error;
    }
  },

  // Delete payment method
  deletePaymentMethod: async (methodId) => {
    try {
      await walletApi.deletePaymentMethod(methodId);

      set((state) => ({
        fundingMethods: state.fundingMethods.filter((m) => m.id !== methodId),
      }));
    } catch (error) {
      throw error;
    }
  },

  // Set default payment method
  setDefaultPaymentMethod: async (methodId) => {
    try {
      const response = await walletApi.setDefaultPaymentMethod(methodId);

      set({
        defaultFundingMethodId: methodId,
        fundingMethods: response.method,
      });
    } catch (error) {
      throw error;
    }
  },
}));
