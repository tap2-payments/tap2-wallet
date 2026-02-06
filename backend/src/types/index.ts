export interface User {
  id: string;
  email: string;
  phone: string;
  auth0Id?: string;
  kycVerified: boolean;
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: 'payment' | 'p2p' | 'fund' | 'withdraw';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'card' | 'bank' | 'wallet_balance';
  provider?: string;
  lastFour?: string;
}

export interface MerchantPaymentInput {
  userId: string;
  merchantId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
}
