# Tap-to-Pay Implementation Plan

## Overview

This document outlines the technical implementation plan for the Tap-to-Pay feature, which allows customers to pay at Tap2 merchants using NFC tap or QR code scanning.

**Epic Reference**: Epic 1: Tap-to-Pay at Merchants
**Priority**: P0 (MVP)
**Target**: Q2 2026

## User Stories in Scope

| ID | Story | Priority |
|----|-------|----------|
| WALLET-001 | Tap phone to pay at any Tap2 merchant | P0 |
| WALLET-002 | Scan QR code if NFC unavailable | P1 |
| WALLET-003 | View payment history | P1 |
| WALLET-004 | Add debit card as funding source | P0 |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Tap-to-Pay Flow                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐      ┌─────────────┐ │
│  │   Customer   │   NFC/   │   Merchant   │      │   Backend   │ │
│  │   Phone      │────────▶│   Phone/POS  │─────▶│   API       │ │
│  │              │   QR     │              │      │             │ │
│  └──────────────┘         └──────────────┘      └─────────────┘ │
│         │                         │                     │        │
│         ▼                         ▼                     ▼        │
│  ┌──────────────┐         ┌──────────────┐      ┌─────────────┐ │
│  │ Tap2 Wallet  │         │ Tap2 Merchant│      │  Payment    │ │
│  │    App       │         │    App       │      │  Processor  │ │
│  └──────────────┘         └──────────────┘      └─────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 1: Foundation & Infrastructure

### 1.1 Backend API Setup

**API Endpoints to Implement:**

```typescript
// Payment initiation
POST /v1/payments/merchant
Request: { merchantId, amount, currency, paymentMethod }
Response: { paymentId, status, timestamp }

// Payment status check
GET /v1/payments/:id/status
Response: { paymentId, status, amount, merchant, createdAt }

// NFC handshake
POST /v1/payments/nfc/initiate
Request: { merchantId, nonce }
Response: { paymentId, encryptedPayload }

// QR code payment
POST /v1/payments/qr/process
Request: { qrData, amount, tip }
Response: { paymentId, status }

// Payment history
GET /v1/payments/history
Query: ?limit=20&offset=0&startDate=&endDate=
Response: { transactions: [], total, hasMore }
```

**Database Schema:**

```sql
-- Merchants table
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(255) NOT NULL,
  tap2_id VARCHAR(50) UNIQUE NOT NULL,  -- Merchant Tap2 ID
  business_type VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods table
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL,  -- 'card', 'bank', 'wallet_balance'
  provider VARCHAR(50),        -- 'stripe', 'plaid'
  provider_id VARCHAR(255),    -- External provider ID
  is_default BOOLEAN DEFAULT FALSE,
  last_four VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Merchant payments table (extends transactions)
CREATE TABLE merchant_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  merchant_id UUID REFERENCES merchants(id),
  payment_method_id UUID REFERENCES payment_methods(id),
  payment_type VARCHAR(20) NOT NULL,  -- 'nfc', 'qr'
  qr_code_id VARCHAR(100),
  nfc_nonce VARCHAR(100),
  tip_amount DECIMAL(10,2) DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Security Layer

**Requirements:**
- JWT authentication for all API calls
- Device fingerprinting for fraud prevention
- Request signing for NFC transactions
- Rate limiting (10 payments/minute per user)

```typescript
// Request signing for NFC
interface NFCPayload {
  paymentId: string;
  merchantId: string;
  amount: number;
  nonce: string;
  timestamp: number;
  signature: string;  // HMAC-SHA256
}
```

### 1.3 Infrastructure Setup

| Component | Tool/Service | Purpose |
|-----------|--------------|---------|
| API Hosting | Fly.io / AWS | Backend deployment |
| Database | PostgreSQL (Supabase/RDS) | Data persistence |
| Queue | Redis/BullMQ | Async payment processing |
| Monitoring | Sentry | Error tracking |
| Logging | Datadog | Structured logs |

## Phase 2: Mobile App - NFC Payment

### 2.1 NFC Integration

**Library:** `react-native-nfc-manager`

**Implementation:**

```typescript
// services/NFCService.ts
import NfcManager, { NdefRecord } from 'react-native-nfc-manager';

interface NFCPaymentData {
  merchantId: string;
  merchantName: string;
  amount: number;
  currency: string;
  nonce: string;
  timestamp: number;
}

class NFCService {
  async initialize(): Promise<boolean> {
    try {
      await NfcManager.start();
      return true;
    } catch (error) {
      console.error('NFC init failed:', error);
      return false;
    }
  }

  async listenForMerchantTag(
    callback: (data: NFCPaymentData) => void,
    timeout = 30000
  ): Promise<void> {
    const timeoutId = setTimeout(() => {
      this.stopListening();
    }, timeout);

    await NfcManager.requestTechnology(NfcManager.Ndef);

    const tag = await NfcManager.getTag();
    const payload = this.parseNdefPayload(tag.ndefMessage);

    clearTimeout(timeoutId);
    callback(payload);

    await NfcManager.cancelTechnologyRequest();
  }

  private parseNdefPayload(ndefMessage: NdefRecord[]): NFCPaymentData {
    // Parse NDEF record from merchant
    // Format: JSON string in TNF_WELL_KNOWN record
    const record = ndefMessage[0];
    const payload = String.fromCharCode(...record.payload);
    return JSON.parse(payload);
  }

  async stopListening(): Promise<void> {
    await NfcManager.cancelTechnologyRequest();
  }

  async isNFCAvailable(): Promise<boolean> {
    return await NfcManager.isEnabled();
  }
}

export default new NFCService();
```

### 2.2 Payment Flow (NFC)

```
┌─────────────────────────────────────────────────────────────────┐
│                    NFC Payment Sequence                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Customer Phone              Merchant Phone       Backend API    │
│       │                          │                    │          │
│       │  1. Open "Pay" screen     │                    │          │
│       │  2. Activate NFC listener │                    │          │
│       │                          │                    │          │
│       │  ◄────────────────────────────── 3. NFC tag     │          │
│       │       (merchant payment data)                     │          │
│       │                          │                    │          │
│       │  4. Show payment details  │                    │          │
│       │  5. User confirms         │                    │          │
│       │                          │                    │          │
│       │  ──────────────────────────────────────────▶  6. Initiate │
│       │                          │                    │    payment │
│       │                          │                    │          │
│       │  7. Show confirmation     │                    │          │
│       │       (haptic + visual)   │                    │          │
│       │                          │ ◄────────────────── 8. Notify  │
│       │                          │     merchant        │          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Screen: Payment Confirmation**

```typescript
// screens/PaymentConfirmationScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

export function PaymentConfirmationScreen() {
  const route = useRoute();
  const { merchantData } = route.params as { merchantData: NFCPaymentData };
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleConfirm = async () => {
    setProcessing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await api.payments.initiateMerchantPayment({
        merchantId: merchantData.merchantId,
        amount: merchantData.amount,
        paymentMethod: 'default',
        type: 'nfc',
        nonce: merchantData.nonce,
      });

      if (result.status === 'completed') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSuccess(true);
        // Navigate to receipt
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // Show error
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.merchantName}>{merchantData.merchantName}</Text>
      <Text style={styles.amount}>
        ${(merchantData.amount / 100).toFixed(2)}
      </Text>

      {success ? (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>Payment Complete!</Text>
          <Pressable onPress={() => navigation.navigate('Home')}>
            <Text style={styles.doneButton}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handleConfirm}
          disabled={processing}
          style={styles.confirmButton}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>Confirm Payment</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}
```

### 2.3 Haptic & Visual Feedback

```typescript
// services/FeedbackService.ts
import * as Haptics from 'expo-haptics';

export class FeedbackService {
  // NFC tag detected
  static tagDetected() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  // Payment confirmed
  static paymentConfirmed() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  // Payment complete
  static paymentComplete() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // Payment failed
  static paymentFailed() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  // Warning/attention
  static warning() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}
```

## Phase 3: Mobile App - QR Code Fallback

### 3.1 QR Scanning

**Library:** `react-native-vision-camera`

```typescript
// services/QRScannerService.ts
import { Camera, CameraRuntimeError } from 'react-native-vision-camera';

interface QRPaymentData {
  merchantId: string;
  merchantName: string;
  sessionId: string;
  timestamp: number;
}

class QRScannerService {
  private camera: Camera | null = null;

  async initialize(): Promise<boolean> {
    const permission = await Camera.requestCameraPermission();
    return permission === 'granted';
  }

  parseQRCode(data: string): QRPaymentData | null {
    try {
      // Expected format: tap2://pay?merchantId=xxx&sessionId=yyy&ts=zzz
      if (!data.startsWith('tap2://pay')) {
        return null;
      }

      const url = new URL(data);
      return {
        merchantId: url.searchParams.get('merchantId') || '',
        merchantName: url.searchParams.get('merchantName') || 'Merchant',
        sessionId: url.searchParams.get('sessionId') || '',
        timestamp: parseInt(url.searchParams.get('ts') || '0'),
      };
    } catch {
      return null;
    }
  }

  async isCameraAvailable(): Promise<boolean> {
    const devices = await Camera.getAvailableCameraDevices();
    return devices.length > 0;
  }
}

export default new QRScannerService();
```

### 3.2 QR Code Screen

```typescript
// screens/QRScanScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { Camera, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import { scanBarcodes } from 'vision-camera-code-scanner';
import { useNavigation } from '@react-navigation/native';

export function QRScanScreen() {
  const navigation = useNavigation();
  const devices = useCameraDevices();
  const device = devices.back;
  const [scanned, setScanned] = useState(false);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const barcodes = scanBarcodes(frame, ['qr'], { checkInverted: true });

    if (barcodes.length > 0 && !scanned) {
      const qrData = barcodes[0].displayValue;
      // Process QR data
      setScanned(true);
      navigation.navigate('PaymentConfirmation', { qrData });
    }
  }, [scanned]);

  if (!device) {
    return (
      <View style={styles.container}>
        <Text>Camera not available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        frameProcessorFps={5}
      />
      <View style={styles.overlay}>
        <View style={styles.scanArea} />
        <Text style={styles.instruction}>
          Position QR code within the frame
        </Text>
      </View>
      <Pressable
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}
```

## Phase 4: Payment History

### 4.1 Transaction List Screen

```typescript
// screens/PaymentHistoryScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { api } from '@/services/api';

interface Transaction {
  id: string;
  merchantName: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  type: 'nfc' | 'qr';
}

export function PaymentHistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = async () => {
    try {
      const response = await api.payments.getHistory();
      setTransactions(response.data);
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <View>
        <Text style={styles.merchantName}>{item.merchantName}</Text>
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.amount}>
        ${(item.amount / 100).toFixed(2)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTransactions();
            }}
          />
        }
      />
    </View>
  );
}
```

## Phase 5: Funding Source Management

### 5.1 Card Onboarding

```typescript
// services/CardService.ts
import { Stripe } from '@stripe/stripe-react-native';

class CardService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_PUBLISHABLE_KEY);
  }

  async addPaymentMethod(cardDetails: CardDetails): Promise<string> {
    // 1. Create Stripe payment method
    const { paymentMethod, error } = await this.stripe.createPaymentMethod({
      type: 'Card',
      card: cardDetails,
      billingDetails: cardDetails.billingDetails,
    });

    if (error) {
      throw new Error(error.message);
    }

    // 2. Attach to user in backend
    const response = await api.paymentMethods.create({
      providerId: paymentMethod.id,
      type: 'card',
      lastFour: paymentMethod.card.last4,
      expiryMonth: paymentMethod.card.expMonth,
      expiryYear: paymentMethod.card.expYear,
    });

    return response.data.id;
  }

  async setDefault(paymentMethodId: string): Promise<void> {
    await api.paymentMethods.setDefault(paymentMethodId);
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    await api.paymentMethods.delete(paymentMethodId);
  }
}

export default new CardService();
```

### 5.2 Add Card Screen

```typescript
// screens/AddCardScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { CardService } from '@/services/CardService';

export function AddCardScreen() {
  const [loading, setLoading] = useState(false);
  const { confirmPayment, loading: stripeLoading } = useConfirmPayment();

  const handleAddCard = async () => {
    setLoading(true);

    try {
      // Validate card with a small test charge
      // Then save as payment method
      await CardService.addPaymentMethod(cardDetails);
      Alert.alert('Success', 'Card added successfully');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Payment Method</Text>

      <CardField
        postalCodeEnabled={false}
        placeholder={{
          number: '4242 4242 4242 4242',
          expiry: 'MM/YY',
          cvc: 'CVC',
        }}
        style={styles.cardField}
      />

      <Pressable
        onPress={handleAddCard}
        disabled={loading || stripeLoading}
        style={styles.addButton}
      >
        <Text style={styles.addButtonText}>
          {loading ? 'Adding...' : 'Add Card'}
        </Text>
      </Pressable>
    </View>
  );
}
```

## Testing Strategy

### Unit Tests

| Component | Test Coverage Goal |
|-----------|-------------------|
| NFCService | 90% - Tag parsing, error handling |
| QRScannerService | 90% - URL parsing, validation |
| PaymentService | 95% - API calls, transaction logic |
| CardService | 95% - Stripe integration |

### Integration Tests

| Test Scenario | Expected Result |
|---------------|-----------------|
| NFC tap → payment initiation | Payment created, status pending |
| QR scan → payment initiation | Payment created, status pending |
| Payment confirmation | Status changes to completed |
| Invalid card declined | Appropriate error message |
| Network timeout | Retry mechanism triggered |

### E2E Tests

```typescript
// e2e/tapToPay.spec.ts
describe('Tap-to-Pay Flow', () => {
  it('should complete NFC payment from tap to confirmation', async () => {
    await app.launch();
    await app.tap('Pay');
    await app.simulateNFCTag(merchantTag);
    await app.expectElement('merchant-name').toHaveText('Test Merchant');
    await app.expectElement('amount').toHaveText('$10.00');
    await app.tap('confirm-payment');
    await app.expectElement('success-message').toBeVisible();
  });

  it('should fall back to QR when NFC unavailable', async () => {
    await app.launch();
    await app.tap('Pay');
    await app.tap('use-qr-instead');
    await app.scanQRCode(testQRCode);
    await app.expectElement('payment-confirmation').toBeVisible();
  });
});

### Manual Testing Checklist

- [ ] NFC tap works on iOS device
- [ ] NFC tap works on Android device
- [ ] QR scanning works on both platforms
- [ ] Payment confirmation haptic feedback
- [ ] Payment failure handling
- [ ] Network offline behavior
- [ ] Transaction history updates
- [ ] Card addition flow
- [ ] Card validation works

## Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Backend API | 2 weeks | API endpoints, database schema, security layer |
| Phase 2: NFC Payment | 3 weeks | NFC integration, payment flow, confirmation screen |
| Phase 3: QR Fallback | 2 weeks | QR scanner, QR payment flow |
| Phase 4: Payment History | 1 week | Transaction list, filtering, details |
| Phase 5: Funding Sources | 2 weeks | Card onboarding, payment method management |
| Testing & Polish | 2 weeks | Unit tests, E2E tests, bug fixes |

**Total: ~12 weeks**

## Dependencies

| Dependency | Required For |
|------------|--------------|
| Stripe account | Card processing |
| Auth0 tenant | User authentication |
| PostgreSQL database | Data persistence |
| Apple Developer account | iOS NFC entitlement |
| Google Play Console | Android NFC permission |
| Sentry account | Error monitoring |

## Open Questions

1. **Merchant NFC Format**: What is the exact NDEF payload format from merchant devices?
2. **Payment Timeout**: Should payments auto-cancel after X seconds of inactivity?
3. **Offline Mode**: Should any functionality work without network?
4. **Receipt Delivery**: Email, SMS, or in-app only?
5. **Multiple Cards**: Support for split payments across cards?

## Success Criteria

- [ ] NFC payment completes in <3 seconds from tap to confirmation
- [ ] QR fallback works when NFC unavailable
- [ ] Payment history reflects transactions within 1 second
- [ ] Card onboarding works with Stripe test cards
- [ ] 95% test coverage for payment logic
- [ ] No critical security vulnerabilities
- [ ] E2E tests pass consistently

---

**Document Version**: 1.0
**Last Updated**: February 2026
**Next Review**: After Phase 1 completion
