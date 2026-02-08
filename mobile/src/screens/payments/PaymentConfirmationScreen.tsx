/**
 * Payment Confirmation Screen
 * Confirm payment details before processing
 *
 * Reference: docs/PLANS-tap-to-pay.md
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { PaymentSummaryCard, Button } from '@/components';
import { paymentApi, parsePaymentError } from '@/services/payment.api';
import type { NFCPaymentData, PaymentResultData } from '@/types';

interface PaymentConfirmationRouteParams {
  merchantData: NFCPaymentData;
  type: 'nfc' | 'qr';
}

export const PaymentConfirmationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { merchantData, type } = (route.params as any) as PaymentConfirmationRouteParams;

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format amount for display
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: merchantData.currency || 'USD',
    }).format(amount / 100);
  };

  // Handle confirm payment
  const handleConfirm = useCallback(async () => {
    setProcessing(true);
    setError(null);

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Generate payment payload
      const payload = {
        merchantId: merchantData.merchantId,
        amount: merchantData.amount,
        currency: merchantData.currency || 'USD',
        nonce: merchantData.nonce,
        type,
      };

      // Initiate payment
      const response = await paymentApi.initiateMerchantPayment(payload);

      // Poll for payment status
      const status = await paymentApi.pollPaymentStatus(
        response.paymentId,
        20, // max attempts
        500 // interval ms
      );

      if (status.status === 'completed') {
        // Success!
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const resultData: PaymentResultData = {
          state: 'success',
          paymentId: status.paymentId,
          amount: status.amount,
          merchantName: status.merchant.name,
        };

        (navigation as any).replace('PaymentResult', resultData);
      } else if (status.status === 'failed') {
        // Payment failed
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        const resultData: PaymentResultData = {
          state: 'failed',
          paymentId: status.paymentId,
          amount: status.amount,
          merchantName: status.merchant.name,
          errorMessage: status.errorMessage || 'Payment failed',
          errorCode: status.errorCode,
        };

        (navigation as any).replace('PaymentResult', resultData);
      } else {
        // Still pending - treat as timeout
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        const resultData: PaymentResultData = {
          state: 'timeout',
          paymentId: response.paymentId,
          amount: response.amount,
          merchantName: response.merchant.name,
          errorMessage: 'Payment is taking longer than expected',
        };

        (navigation as any).replace('PaymentResult', resultData);
      }
    } catch (err) {
      // Parse error
      const parsedError = parsePaymentError(err);
      setError(parsedError.userMessage);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Show alert for critical errors
      if (parsedError.code === 'INSUFFICIENT_FUNDS') {
        Alert.alert(
          'Insufficient Funds',
          'You don\'t have enough balance to complete this payment. Please add funds to your wallet.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Add Funds', onPress: () => {
              (navigation as any).navigate('FundWallet');
            }},
          ]
        );
      }
    } finally {
      setProcessing(false);
    }
  }, [merchantData, type, navigation]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleCancel}>
          <Text style={styles.backButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Confirm Payment</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Payment Summary Card */}
        <PaymentSummaryCard
          merchantName={merchantData.merchantName}
          amount={merchantData.amount}
          currency={merchantData.currency}
          type={type}
          showIcon
        />

        {/* Payment Details */}
        <View style={styles.detailsSection}>
          <Text style={styles.detailsTitle}>Payment Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Method</Text>
            <Text style={styles.detailValue}>Wallet Balance</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Type</Text>
            <Text style={styles.detailValue}>
              {type === 'nfc' ? 'Tap to Pay (NFC)' : 'QR Code'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Merchant ID</Text>
            <Text style={styles.detailValue}>{merchantData.merchantId}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction Fee</Text>
            <Text style={styles.detailValue}>Free</Text>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Security Notice */}
        <View style={styles.noticeContainer}>
          <Text style={styles.noticeText}>
            Secure payment powered by Tap2. Your payment information is encrypted.
          </Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          title="Confirm Payment"
          onPress={handleConfirm}
          disabled={processing}
          loading={processing}
          variant="primary"
          size="large"
          fullWidth
        />
        <Button
          title="Cancel"
          onPress={handleCancel}
          disabled={processing}
          variant="ghost"
          size="medium"
          fullWidth
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  detailsSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 20,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  noticeContainer: {
    marginTop: 20,
    paddingHorizontal: 4,
  },
  noticeText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
  buttonContainer: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
});
