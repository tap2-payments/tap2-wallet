/**
 * Payment Summary Card Component
 * Displays payment details for confirmation
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';

export interface PaymentSummaryCardProps {
  merchantName: string;
  amount: number;
  currency?: string;
  type?: 'nfc' | 'qr';
  style?: ViewStyle;
  showIcon?: boolean;
}

/**
 * Format amount for display
 */
export const formatAmount = (amount: number, currency = 'USD'): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  });
  return formatter.format(amount / 100);
};

export const PaymentSummaryCard: React.FC<PaymentSummaryCardProps> = ({
  merchantName,
  amount,
  currency = 'USD',
  type,
  style,
  showIcon = true,
}) => {
  return (
    <View style={[styles.container, style]}>
      {showIcon && (
        <View style={styles.iconContainer}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>
              {type === 'qr' ? 'QR' : 'NFC'}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.merchantLabel}>Paying</Text>
      <Text style={styles.merchantName}>{merchantName}</Text>

      <View style={styles.divider} />

      <Text style={styles.amountLabel}>Amount</Text>
      <Text style={styles.amount}>{formatAmount(amount, currency)}</Text>

      {type && (
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>
            {type === 'nfc' ? 'Tap to Pay' : 'QR Payment'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  merchantLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  merchantName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  amount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
  },
  typeBadge: {
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F0F8FF',
    borderRadius: 16,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#007AFF',
  },
});
