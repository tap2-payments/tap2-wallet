import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { walletApi } from '@/services';
import type { RootStackParamList } from '@/navigation';
import type { TransactionDetails as TransactionDetailsType } from '@/services/wallet.api';

interface TransactionDetailsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TransactionDetails'>;
  route: RouteProp<RootStackParamList, 'TransactionDetails'>;
}

export const TransactionDetailsScreen: React.FC<
  TransactionDetailsScreenProps
> = ({ navigation, route }) => {
  const { transactionId } = route.params;
  const [transaction, setTransaction] =
    useState<TransactionDetailsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTransactionDetails();
  }, [transactionId]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Transaction Details',
    });
  }, [navigation]);

  const loadTransactionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await walletApi.fetchTransactionDetails(transactionId);
      setTransaction(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load transaction details'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number, type: string): string => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);

    const isPositive = type === 'fund';
    const sign = isPositive ? '+' : '-';
    return `${sign}${formatted}`;
  };

  const getAmountColor = (type: string): string => {
    return type === 'fund' ? '#34C759' : '#333333';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#34C759';
      case 'pending':
        return '#FF9500';
      case 'failed':
        return '#FF3B30';
      default:
        return '#666666';
    }
  };

  const getIcon = (type: string): string => {
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

  const getTypeLabel = (type: string): string => {
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

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderDetailRow = (label: string, value: string | React.ReactNode) => (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error || !transaction) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to load</Text>
        <Text style={styles.errorMessage}>
          {error || 'Transaction not found'}
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={loadTransactionDetails}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Amount Card */}
      <View style={styles.amountCard}>
        <Text style={styles.icon}>{getIcon(transaction.type)}</Text>
        <Text
          style={[
            styles.amount,
            { color: getAmountColor(transaction.type) },
          ]}
        >
          {formatAmount(transaction.amount, transaction.type)}
        </Text>
        <Text style={styles.typeLabel}>{getTypeLabel(transaction.type)}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(transaction.status) + '20' },
          ]}
        >
          <Text
            style={[styles.statusText, { color: getStatusColor(transaction.status) }]}
          >
            {transaction.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Transaction Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transaction Details</Text>
        <View style={styles.sectionContent}>
          {renderDetailRow('Date', formatDate(transaction.createdAt))}
          {renderDetailRow('Type', getTypeLabel(transaction.type))}
          {renderDetailRow('Status', transaction.status.toUpperCase())}
          {transaction.referenceId &&
            renderDetailRow('Reference', transaction.referenceId)}

          {transaction.metadata?.merchantName &&
            renderDetailRow('Merchant', transaction.metadata.merchantName)}

          {transaction.metadata?.recipientName &&
            renderDetailRow('Recipient', transaction.metadata.recipientName)}

          {transaction.metadata?.description &&
            renderDetailRow('Description', transaction.metadata.description)}

          {transaction.metadata?.fee &&
            renderDetailRow(
              'Fee',
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(transaction.metadata.fee / 100)
            )}
        </View>
      </View>

      {/* Support Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Need Help?</Text>
        <View style={styles.sectionContent}>
          <TouchableOpacity style={styles.supportButton}>
            <Text style={styles.supportButtonText}>Report an Issue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.supportButton}>
            <Text style={styles.supportButtonText}>View Receipt</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  content: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  supportButton: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  supportButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
});
