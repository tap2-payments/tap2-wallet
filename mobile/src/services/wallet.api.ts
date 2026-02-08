import api from './api';
import { Transaction } from '@/types';
import type { PaymentMethod } from '@/components/wallet';

// Types
export interface WalletBalance {
  balance: number; // in cents
  currency: string;
  availableBalance: number; // in cents
  pendingBalance: number; // in cents
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface TransactionDetails extends Transaction {
  walletId: string;
  referenceId?: string;
  metadata?: TransactionMetadata;
}

export interface TransactionMetadata {
  merchantName?: string;
  merchantId?: string;
  recipientName?: string;
  recipientId?: string;
  paymentMethodId?: string;
  fee?: number;
  description?: string;
}

export interface FundWalletRequest {
  amount: number; // in cents
  paymentMethodId: string;
}

export interface FundWalletResponse {
  transaction: Transaction;
  newBalance: number;
}

export interface WithdrawRequest {
  amount: number; // in cents
  destination: string; // bank account ID or external account
  type: 'instant' | 'standard';
}

export interface WithdrawResponse {
  transaction: Transaction;
  newBalance: number;
  fee: number;
  estimatedArrival?: string;
}

export interface FundingMethodsResponse {
  methods: PaymentMethod[];
  defaultMethodId?: string;
}

export interface AddPaymentMethodRequest {
  type: 'card' | 'bank';
  token: string; // Stripe token or Plaid public token
  isDefault?: boolean;
  metadata?: {
    brand?: string;
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    bankName?: string;
    accountType?: 'checking' | 'savings';
  };
}

export interface AddPaymentMethodResponse {
  method: PaymentMethod;
}

export interface DeletePaymentMethodResponse {
  success: boolean;
}

export interface SetDefaultPaymentMethodResponse {
  method: PaymentMethod;
}

// API Functions

/**
 * Fetch wallet balance
 */
export const fetchBalance = async (): Promise<WalletBalance> => {
  const response = await api.get<WalletBalance>('/wallet/balance');
  return response.data;
};

/**
 * Fetch transactions with pagination
 */
export const fetchTransactions = async (params?: {
  page?: number;
  pageSize?: number;
  type?: Transaction['type'] | 'all';
  status?: Transaction['status'];
  startDate?: string;
  endDate?: string;
}): Promise<TransactionsResponse> => {
  const response = await api.get<TransactionsResponse>('/wallet/transactions', {
    params: {
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
      type: params?.type,
      status: params?.status,
      startDate: params?.startDate,
      endDate: params?.endDate,
    },
  });
  return response.data;
};

/**
 * Fetch transaction details
 */
export const fetchTransactionDetails = async (
  transactionId: string
): Promise<TransactionDetails> => {
  const response = await api.get<TransactionDetails>(
    `/wallet/transactions/${transactionId}`
  );
  return response.data;
};

/**
 * Fund wallet with amount
 */
export const fundWallet = async (
  request: FundWalletRequest
): Promise<FundWalletResponse> => {
  const response = await api.post<FundWalletResponse>(
    '/wallet/fund',
    request
  );
  return response.data;
};

/**
 * Withdraw funds from wallet
 */
export const withdraw = async (
  request: WithdrawRequest
): Promise<WithdrawResponse> => {
  const response = await api.post<WithdrawResponse>(
    '/wallet/withdraw',
    request
  );
  return response.data;
};

/**
 * Fetch funding methods (payment methods)
 */
export const fetchFundingMethods = async (): Promise<FundingMethodsResponse> => {
  const response = await api.get<FundingMethodsResponse>(
    '/wallet/funding-methods'
  );
  return response.data;
};

/**
 * Add a new payment method
 */
export const addPaymentMethod = async (
  request: AddPaymentMethodRequest
): Promise<AddPaymentMethodResponse> => {
  const response = await api.post<AddPaymentMethodResponse>(
    '/wallet/funding-methods',
    request
  );
  return response.data;
};

/**
 * Delete a payment method
 */
export const deletePaymentMethod = async (
  methodId: string
): Promise<DeletePaymentMethodResponse> => {
  const response = await api.delete<DeletePaymentMethodResponse>(
    `/wallet/funding-methods/${methodId}`
  );
  return response.data;
};

/**
 * Set default payment method
 */
export const setDefaultPaymentMethod = async (
  methodId: string
): Promise<SetDefaultPaymentMethodResponse> => {
  const response = await api.put<SetDefaultPaymentMethodResponse>(
    `/wallet/funding-methods/${methodId}/default`
  );
  return response.data;
};

// Wallet API object
export const walletApi = {
  fetchBalance,
  fetchTransactions,
  fetchTransactionDetails,
  fundWallet,
  withdraw,
  fetchFundingMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
};

export default walletApi;
