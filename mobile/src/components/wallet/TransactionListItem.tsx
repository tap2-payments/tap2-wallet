import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Transaction } from '@/types';

export interface TransactionListItemProps {
  transaction: Transaction;
  onPress?: () => void;
}

export const TransactionListItem: React.FC<TransactionListItemProps> = ({
  transaction,
  onPress,
}) => {
  const formatAmount = (amount: number, type: Transaction['type']): string => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);

    // Fund transactions are positive, others are negative
    const isPositive = type === 'fund';
    const sign = isPositive ? '+' : '-';
    return `${sign}${formatted}`;
  };

  const getAmountColor = (type: Transaction['type']): string => {
    return type === 'fund' ? '#34C759' : '#333333';
  };

  const getIcon = (type: Transaction['type'], status: Transaction['status']): string => {
    if (status === 'failed') return '❌';
    if (status === 'pending') return '⏳';

    switch (type) {
      case 'payment':
        return '🛒';
      case 'p2p':
        return '👤';
      case 'fund':
        return '💰';
      case 'withdraw':
        return '🏦';
      default:
        return '💳';
    }
  };

  const getTypeLabel = (type: Transaction['type']): string => {
    switch (type) {
      case 'payment':
        return 'Purchase';
      case 'p2p':
        return 'P2P Transfer';
      case 'fund':
        return 'Money Added';
      case 'withdraw':
        return 'Withdrawal';
      default:
        return 'Transaction';
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const transactionDate = new Date(date);
    const diffMs = now.getTime() - transactionDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return transactionDate.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return transactionDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getMerchantName = (): string => {
    if (transaction.metadata?.merchantName) {
      return String(transaction.metadata.merchantName);
    }
    if (transaction.metadata?.recipientName) {
      return String(transaction.metadata.recipientName);
    }
    return getTypeLabel(transaction.type);
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>
          {getIcon(transaction.type, transaction.status)}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.merchantName} numberOfLines={1}>
            {getMerchantName()}
          </Text>
          <Text
            style={[
              styles.amount,
              { color: getAmountColor(transaction.type) },
            ]}
          >
            {formatAmount(transaction.amount, transaction.type)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text style={styles.date}>{formatDate(transaction.createdAt)}</Text>
          <Text
            style={[
              styles.status,
              transaction.status === 'completed' && styles.completedStatus,
              transaction.status === 'pending' && styles.pendingStatus,
              transaction.status === 'failed' && styles.failedStatus,
            ]}
          >
            {transaction.status.charAt(0).toUpperCase() +
              transaction.status.slice(1)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pressed: {
    backgroundColor: '#F5F5F5',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  merchantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginRight: 12,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: '#999999',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  completedStatus: {
    color: '#34C759',
  },
  pendingStatus: {
    color: '#FF9500',
  },
  failedStatus: {
    color: '#FF3B30',
  },
});
