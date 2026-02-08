/**
 * Payment API Service
 * API client for payment endpoints
 *
 * Reference: docs/PLANS-tap-to-pay.md
 * Endpoints:
 * - POST /api/v1/payments/merchant
 * - POST /api/v1/payments/qr
 * - GET /api/v1/payments/:id/status
 * - GET /api/v1/payments/history
 */

import apiClient from './api';
import type {
  MerchantPaymentInput,
  PaymentInitResponse,
  PaymentStatusResponse,
  PaymentHistoryInput,
  PaymentHistoryResponse,
} from '@/types';

// ============================================================================
// Payment Endpoints
// ============================================================================

/**
 * Initiate a merchant payment via NFC or QR
 */
export async function initiateMerchantPayment(
  data: MerchantPaymentInput
): Promise<PaymentInitResponse> {
  const endpoint = data.type === 'nfc' ? '/payments/merchant' : '/payments/qr';
  const response = await apiClient.post<PaymentInitResponse>(endpoint, data);
  return response.data;
}

/**
 * Get payment status by ID
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  const response = await apiClient.get<PaymentStatusResponse>(`/payments/${paymentId}/status`);
  return response.data;
}

/**
 * Poll payment status until completion or timeout
 * @param paymentId Payment ID to check
 * @param maxAttempts Maximum number of polling attempts (default: 20)
 * @param intervalMs Polling interval in milliseconds (default: 500)
 */
export async function pollPaymentStatus(
  paymentId: string,
  maxAttempts = 20,
  intervalMs = 500
): Promise<PaymentStatusResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getPaymentStatus(paymentId);

    // Return if payment is in final state
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }

    // Wait before next poll
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // Return last status if timeout reached
  return await getPaymentStatus(paymentId);
}

/**
 * Get payment history with optional filters
 */
export async function getPaymentHistory(
  params?: PaymentHistoryInput
): Promise<PaymentHistoryResponse> {
  const response = await apiClient.get<PaymentHistoryResponse>('/payments/history', { params });
  return response.data;
}

/**
 * Get recent payment transactions
 */
export async function getRecentPayments(limit = 10): Promise<PaymentHistoryResponse> {
  return getPaymentHistory({ limit });
}

/**
 * Get payments by date range
 */
export async function getPaymentsByDateRange(
  startDate: string,
  endDate: string,
  limit = 50
): Promise<PaymentHistoryResponse> {
  return getPaymentHistory({ startDate, endDate, limit });
}

/**
 * Get payments by status
 */
export async function getPaymentsByStatus(
  status: 'pending' | 'completed' | 'failed',
  limit = 50
): Promise<PaymentHistoryResponse> {
  return getPaymentHistory({ status, limit });
}

/**
 * Get payments by type (NFC or QR)
 */
export async function getPaymentsByType(
  type: 'nfc' | 'qr',
  limit = 50
): Promise<PaymentHistoryResponse> {
  return getPaymentHistory({ type, limit });
}

// ============================================================================
// Payment API Object (for convenience)
// ============================================================================

export const paymentApi = {
  initiateMerchantPayment,
  getPaymentStatus,
  pollPaymentStatus,
  getPaymentHistory,
  getRecentPayments,
  getPaymentsByDateRange,
  getPaymentsByStatus,
  getPaymentsByType,
};

// ============================================================================
// Error Helpers
// ============================================================================

export interface PaymentError {
  code: string;
  message: string;
  isRetriable: boolean;
  userMessage: string;
}

/**
 * Parse API error into user-friendly message
 */
export function parsePaymentError(error: any): PaymentError {
  const defaultError: PaymentError = {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    isRetriable: false,
    userMessage: 'Something went wrong. Please try again.',
  };

  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        code: 'TIMEOUT',
        message: 'Request timed out',
        isRetriable: true,
        userMessage: 'Connection timed out. Please check your internet and try again.',
      };
    }
    if (error.message.includes('Network Error')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error',
        isRetriable: true,
        userMessage: 'No internet connection. Please check your network and try again.',
      };
    }
    return defaultError;
  }

  const { status, data } = error.response;

  // Handle specific error codes
  if (data?.code) {
    switch (data.code) {
      case 'INSUFFICIENT_FUNDS':
        return {
          code: 'INSUFFICIENT_FUNDS',
          message: data.error || 'Insufficient funds',
          isRetriable: false,
          userMessage: 'Insufficient balance. Please add funds to your wallet.',
        };
      case 'INVALID_MERCHANT':
        return {
          code: 'INVALID_MERCHANT',
          message: data.error || 'Invalid merchant',
          isRetriable: false,
          userMessage: 'This merchant is not valid or active.',
        };
      case 'PAYMENT_EXPIRED':
        return {
          code: 'PAYMENT_EXPIRED',
          message: data.error || 'Payment expired',
          isRetriable: false,
          userMessage: 'This payment request has expired. Please ask the merchant to try again.',
        };
      case 'INVALID_NONCE':
        return {
          code: 'INVALID_NONCE',
          message: data.error || 'Invalid nonce',
          isRetriable: false,
          userMessage: 'Security verification failed. Please try again.',
        };
      case 'DUPLICATE_PAYMENT':
        return {
          code: 'DUPLICATE_PAYMENT',
          message: data.error || 'Duplicate payment',
          isRetriable: false,
          userMessage: 'This payment has already been processed.',
        };
      case 'RATE_LIMIT_EXCEEDED':
        return {
          code: 'RATE_LIMIT_EXCEEDED',
          message: data.error || 'Too many attempts',
          isRetriable: true,
          userMessage: 'Too many payment attempts. Please wait a moment and try again.',
        };
    }
  }

  // Handle HTTP status codes
  switch (status) {
    case 400:
      return {
        code: 'BAD_REQUEST',
        message: data?.error || 'Invalid request',
        isRetriable: false,
        userMessage: 'Invalid payment details. Please check and try again.',
      };
    case 401:
      return {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
        isRetriable: false,
        userMessage: 'Please log in to complete this payment.',
      };
    case 403:
      return {
        code: 'FORBIDDEN',
        message: 'Forbidden',
        isRetriable: false,
        userMessage: 'You are not authorized to make this payment.',
      };
    case 404:
      return {
        code: 'NOT_FOUND',
        message: 'Payment not found',
        isRetriable: false,
        userMessage: 'Payment not found. It may have been cancelled.',
      };
    case 409:
      return {
        code: 'CONFLICT',
        message: data?.error || 'Payment conflict',
        isRetriable: false,
        userMessage: 'This payment conflicts with an existing transaction.',
      };
    case 429:
      return {
        code: 'RATE_LIMIT',
        message: 'Too many requests',
        isRetriable: true,
        userMessage: 'Please wait a moment before trying again.',
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        code: 'SERVER_ERROR',
        message: 'Server error',
        isRetriable: true,
        userMessage: 'Service temporarily unavailable. Please try again.',
      };
    default:
      return defaultError;
  }
}
