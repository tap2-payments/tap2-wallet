/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Auth stack params
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string };
  VerifyPhone: { phone: string };
  PINSetup: undefined;
  PINVerify: {
    action?: 'payment' | 'transfer' | 'settings' | 'general';
    amount?: number;
    onSuccess?: string;
    onCancelled?: string;
    biometricFallback?: boolean;
  };
  BiometricPrompt: {
    firstTimeSetup?: boolean;
    action?: 'login' | 'payment' | 'transfer' | 'settings';
    onSuccess?: string;
    onCancelled?: string;
  };
};

// Main app stack params
export type MainStackParamList = {
  Home: undefined;
  Wallet: undefined;
  WalletHome: undefined;
  Transactions: undefined;
  TransactionDetails: { transactionId: string };
  FundWallet: undefined;
  Withdraw: undefined;
  FundingSources: undefined;
  AddPaymentMethod: { type?: 'card' | 'bank' };
  Send: undefined;
  Receive: undefined;
  Rewards: undefined;
  RewardsHistory: undefined;
  RewardsOffers: undefined;
  RedeemRewards: { offerId?: string };
  Profile: undefined;
  Settings: undefined;
  Payment: { amount?: number; merchant?: string };
  Transfer: { recipient?: string };
  // Tap-to-Pay screens
  TapToPay: { autoStart?: boolean };
  QRPayment: undefined;
  PaymentConfirmation: { merchantData: NFCPaymentData; type: 'nfc' | 'qr' };
  PaymentResult: PaymentResultData;
  PaymentHistory: undefined;
  // P2P screens
  SendMoney: undefined;
  RequestMoney: undefined;
  ScanQR: undefined;
  ReceiveMoney: { amount?: number };
  SelectRecipient: undefined;
  PhoneLookup: undefined;
  P2PTap: undefined;
  RequestDetails: { requestId: string; type: 'incoming' | 'outgoing' };
  SplitBill: undefined;
};

// Payment types for navigation
export interface NFCPaymentData {
  merchantId: string;
  merchantName: string;
  amount: number;
  currency: string;
  nonce: string;
  timestamp: number;
}

export interface PaymentResultData {
  state: 'success' | 'failed' | 'timeout';
  paymentId?: string;
  amount?: number;
  merchantName?: string;
  errorMessage?: string;
  errorCode?: string;
}

// Root stack params
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainStackParamList>;
  PINVerify: {
    action?: 'payment' | 'transfer' | 'settings' | 'general';
    amount?: number;
    onSuccess?: string;
    onCancelled?: string;
  };
  BiometricPrompt: {
    firstTimeSetup?: boolean;
    action?: 'login' | 'payment' | 'transfer' | 'settings';
    onSuccess?: string;
    onCancelled?: string;
  };
};

// Navigation helpers
export type AuthNavigationProp = NativeStackNavigationProp<AuthStackParamList>;
export type MainNavigationProp = NativeStackNavigationProp<MainStackParamList>;
export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Re-export default navigation prop
export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Import NavigatorScreenParams from React Navigation
// This is a workaround - in actual usage you'd import from @react-navigation/native-stack
type NavigatorScreenParams<T> = T | undefined;
