// Global type definitions

export interface User {
  id: string;
  email: string;
  phone: string;
  kycVerified: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'payment' | 'p2p' | 'fund' | 'withdraw';
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface Payment {
  id: string;
  amount: number;
  merchantId?: string;
  recipientId?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

export interface Reward {
  id: string;
  points: number;
  merchantId: string;
  transactionId: string;
  expiresAt?: Date;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface UserResponse {
  id: string;
  email: string;
  phone: string;
  auth0Id?: string;
  kycVerified: boolean;
  kycVerifiedAt?: Date | null;
  createdAt: Date;
}

export interface RegisterInput {
  email: string;
  phone: string;
  password: string;
  auth0Id?: string;
}

export interface RegisterResponse {
  user: UserResponse;
  token: string;
  expiresIn: number;
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  user: UserResponse;
  token: string;
  expiresIn: number;
}

export interface ProfileUpdateInput {
  email?: string;
  phone?: string;
}

export interface KYCVerifyInput {
  userId: string;
  verified: boolean;
  verificationMethod?: 'persona' | 'manual';
  verificationId?: string;
}

export interface KYCVerifyResponse {
  userId: string;
  kycVerified: boolean;
  kycVerifiedAt?: Date;
}

export interface PinSetInput {
  pin: string;
}

export interface PinVerifyInput {
  pin: string;
}

export interface PinResponse {
  success: boolean;
  message?: string;
}

export type AuthError =
  | 'USER_NOT_FOUND'
  | 'INVALID_CREDENTIALS'
  | 'USER_ALREADY_EXISTS'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'UNAUTHORIZED'
  | 'INVALID_PIN'
  | 'PIN_NOT_SET';

export interface ApiError {
  error: string;
  code?: AuthError;
  status?: number;
}

// ============================================================================
// P2P Types
// ============================================================================

export interface Contact {
  recordID: string;
  givenName: string;
  familyName: string;
  middleName?: string;
  phoneNumbers: Array<{
    label: string;
    number: string;
  }>;
  emailAddresses: Array<{
    label: string;
    email: string;
  }>;
  thumbnailPath?: string;
  hasThumbnail?: boolean;
  isTap2User?: boolean;
  tap2UserId?: string;
}

export interface P2PRecipient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  isTap2User: boolean;
  recentAmount?: number;
  lastSent?: Date;
}

export interface PaymentRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  toUserId: string;
  amount: number;
  currency: string;
  note?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}

export interface SplitBillMember {
  userId?: string;
  name: string;
  amount: number;
  isPaid: boolean;
  avatar?: string;
  contact?: Contact;
}

export interface SplitBill {
  id: string;
  title: string;
  totalAmount: number;
  currency: string;
  createdBy: string;
  members: SplitBillMember[];
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

export interface P2PSendRequest {
  recipientId: string;
  amount: number;
  note?: string;
  paymentMethodId?: string;
}

export interface P2PSendResponse {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed';
  newBalance: number;
  fee: number;
  transaction: Transaction;
}

export interface PaymentRequestCreate {
  recipientId: string;
  amount: number;
  note?: string;
  expiresIn?: number;
}

export interface PaymentRequestResponse {
  requestId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: Date;
}

export interface PendingRequestsResponse {
  incoming: PaymentRequest[];
  outgoing: PaymentRequest[];
}

export interface NFCDiscoveryPayload {
  userId: string;
  username?: string;
  nonce: string;
  timestamp: number;
}

// ============================================================================
// Tap-to-Pay Payment Types
// ============================================================================

/**
 * NDEF Payload from Merchant NFC Tag
 * Format as specified in PLANS-tap-to-pay.md
 */
export interface MerchantNDEFPayload {
  v: string;        // Protocol version (e.g., "1.0")
  m: string;        // Merchant Tap2 ID
  n: string;        // Merchant display name
  amt: number;      // Amount in cents (integer)
  cur: string;      // Currency code (ISO 4217, default "USD")
  ts: number;       // Unix timestamp
  nonce: string;    // Cryptographic nonce for replay protection
}

/**
 * NFC Payment data extracted from merchant tag
 */
export interface NFCPaymentData {
  merchantId: string;
  merchantName: string;
  amount: number;
  currency: string;
  nonce: string;
  timestamp: number;
}

/**
 * QR Code Payment data from merchant QR
 */
export interface QRPaymentData {
  merchantId: string;
  merchantName: string;
  sessionId: string;
  timestamp: number;
  amount?: number; // Optional - merchant may enter amount after scan
}

/**
 * Payment initiation request
 */
export interface MerchantPaymentInput {
  merchantId: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  nonce?: string;
  type: 'nfc' | 'qr';
}

/**
 * Payment initiation response
 */
export interface PaymentInitResponse {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  currency: string;
  merchant: {
    id: string;
    name: string;
  };
  createdAt: string;
}

/**
 * Payment status response
 */
export interface PaymentStatusResponse {
  paymentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount: number;
  currency: string;
  merchant: {
    id: string;
    name: string;
  };
  createdAt: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Payment history item
 */
export interface PaymentHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  type: 'nfc' | 'qr';
  merchant: {
    id: string;
    name: string;
  };
  createdAt: string;
  completedAt?: string;
}

/**
 * Payment history request params
 */
export interface PaymentHistoryInput {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'completed' | 'failed';
  type?: 'nfc' | 'qr';
}

/**
 * Payment history response
 */
export interface PaymentHistoryResponse {
  transactions: PaymentHistoryItem[];
  total: number;
  hasMore: boolean;
}

/**
 * Payment result state
 */
export type PaymentResultState = 'success' | 'failed' | 'timeout';

/**
 * Payment result data for result screen
 */
export interface PaymentResultData {
  state: PaymentResultState;
  paymentId?: string;
  amount?: number;
  merchantName?: string;
  errorMessage?: string;
  errorCode?: string;
}
