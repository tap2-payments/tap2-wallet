/**
 * P2P API Service
 * API client for peer-to-peer payment operations
 */

import apiClient from './api';
import type {
  P2PSendRequest,
  P2PSendResponse,
  PaymentRequestCreate,
  PaymentRequestResponse,
  PendingRequestsResponse,
  PaymentRequest,
  SplitBill,
} from '@/types';

// ============================================================================
// P2P Endpoints
// ============================================================================

/**
 * Send money to another user
 */
export async function sendMoney(data: P2PSendRequest): Promise<P2PSendResponse> {
  const response = await apiClient.post<P2PSendResponse>('/payments/p2p', {
    recipientId: data.recipientId,
    amount: Math.round(data.amount * 100), // Convert to cents
    note: data.note,
    paymentMethodId: data.paymentMethodId,
  });
  return response.data;
}

/**
 * Request money from another user
 */
export async function requestPayment(data: PaymentRequestCreate): Promise<PaymentRequestResponse> {
  const response = await apiClient.post<PaymentRequestResponse>('/payments/request', {
    recipientId: data.recipientId,
    amount: Math.round(data.amount * 100), // Convert to cents
    note: data.note,
    expiresIn: data.expiresIn || 86400, // Default 24 hours
  });
  return response.data;
}

/**
 * Get pending payment requests
 */
export async function getPendingRequests(): Promise<PendingRequestsResponse> {
  const response = await apiClient.get<PendingRequestsResponse>('/payments/requests/pending');
  return response.data;
}

/**
 * Accept a payment request
 */
export async function acceptPaymentRequest(requestId: string): Promise<{ transactionId: string; newBalance: number }> {
  const response = await apiClient.post<{ transactionId: string; newBalance: number }>(
    `/payments/requests/${requestId}/accept`
  );
  return response.data;
}

/**
 * Decline a payment request
 */
export async function declinePaymentRequest(requestId: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/payments/requests/${requestId}/decline`
  );
  return response.data;
}

/**
 * Cancel an outgoing payment request
 */
export async function cancelPaymentRequest(requestId: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/payments/requests/${requestId}/cancel`
  );
  return response.data;
}

/**
 * Get payment request details
 */
export async function getPaymentRequest(requestId: string): Promise<PaymentRequest> {
  const response = await apiClient.get<PaymentRequest>(`/payments/requests/${requestId}`);
  return response.data;
}

// ============================================================================
// Split Bill Endpoints
// ============================================================================

/**
 * Create a new split bill
 */
export async function createSplitBill(data: {
  title: string;
  totalAmount: number;
  memberIds: string[];
  splitType: 'equal' | 'custom';
  customAmounts?: Record<string, number>;
}): Promise<SplitBill> {
  const response = await apiClient.post<SplitBill>('/payments/split', {
    title: data.title,
    totalAmount: Math.round(data.totalAmount * 100), // Convert to cents
    memberIds: data.memberIds,
    splitType: data.splitType,
    customAmounts: data.customAmounts,
  });
  return response.data;
}

/**
 * Get split bill details
 */
export async function getSplitBill(billId: string): Promise<SplitBill> {
  const response = await apiClient.get<SplitBill>(`/payments/split/${billId}`);
  return response.data;
}

/**
 * Pay your share of a split bill
 */
export async function paySplitBillShare(billId: string): Promise<{ transactionId: string; newBalance: number }> {
  const response = await apiClient.post<{ transactionId: string; newBalance: number }>(
    `/payments/split/${billId}/pay`
  );
  return response.data;
}

/**
 * Get user's active split bills
 */
export async function getSplitBills(): Promise<{ bills: SplitBill[] }> {
  const response = await apiClient.get<{ bills: SplitBill[] }>('/payments/split');
  return response.data;
}

// ============================================================================
// User Discovery
// ============================================================================

/**
 * Search for Tap2 users by phone number
 */
export async function lookupUserByPhone(phone: string): Promise<{
  userId: string;
  name: string;
  avatar?: string;
  isTap2User: boolean;
} | null> {
  try {
    const response = await apiClient.get<{
      userId: string;
      name: string;
      avatar?: string;
      isTap2User: boolean;
    }>(`/users/lookup?phone=${encodeURIComponent(phone)}`);
    return response.data;
  } catch (error) {
    // User not found or not a Tap2 user
    return null;
  }
}

/**
 * Search for Tap2 users by email
 */
export async function lookupUserByEmail(email: string): Promise<{
  userId: string;
  name: string;
  avatar?: string;
  isTap2User: boolean;
} | null> {
  try {
    const response = await apiClient.get<{
      userId: string;
      name: string;
      avatar?: string;
      isTap2User: boolean;
    }>(`/users/lookup?email=${encodeURIComponent(email)}`);
    return response.data;
  } catch (error) {
    // User not found or not a Tap2 user
    return null;
  }
}

/**
 * Match multiple phone numbers to Tap2 users
 */
export async function lookupMultipleUsers(phoneNumbers: string[]): Promise<Record<string, {
  userId: string;
  name: string;
  avatar?: string;
}>> {
  try {
    const response = await apiClient.post<Record<string, {
      userId: string;
      name: string;
      avatar?: string;
    }>>('/users/lookup/batch', { phoneNumbers });
    return response.data;
  } catch (error) {
    return {};
  }
}

// ============================================================================
// P2P API Object (for convenience)
// ============================================================================

export const p2pApi = {
  sendMoney,
  requestPayment,
  getPendingRequests,
  acceptPaymentRequest,
  declinePaymentRequest,
  cancelPaymentRequest,
  getPaymentRequest,
  createSplitBill,
  getSplitBill,
  paySplitBillShare,
  getSplitBills,
  lookupUserByPhone,
  lookupUserByEmail,
  lookupMultipleUsers,
};
