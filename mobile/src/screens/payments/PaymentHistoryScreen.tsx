/**
 * Payment History Screen
 * Filtered payment history with date and status filters
 *
 * Reference: docs/PLANS-tap-to-pay.md
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';

import { paymentApi, parsePaymentError } from '@/services/payment.api';
import { formatAmount as formatAmountUtil } from '@/components/payments/PaymentSummaryCard';
import type { PaymentHistoryItem } from '@/types';

type FilterType = 'all' | 'completed' | 'pending' | 'failed';
type DateFilterType = 'all' | 'today' | 'week' | 'month';

export const PaymentHistoryScreen: React.FC = () => {
  const navigation = useNavigation();

  const [transactions, setTransactions] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');

  // Load transactions
  const loadTransactions = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else if (!loading) {
        setLoading(true);
      }

      const params: {
        limit?: number;
        status?: 'pending' | 'completed' | 'failed';
        startDate?: string;
        endDate?: string;
      } = {
        limit: 50,
      };

      // Apply status filter
      if (filter !== 'all') {
        params.status = filter;
      }

      // Apply date filter
      const now = new Date();
      if (dateFilter === 'today') {
        params.startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        params.endDate = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.startDate = weekAgo.toISOString();
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.startDate = monthAgo.toISOString();
      }

      const response = await paymentApi.getPaymentHistory(params);

      setTransactions(response.transactions);
      setHasMore(response.hasMore);
    } catch (error) {
      const parsedError = parsePaymentError(error);
      console.error('Failed to load payment history:', parsedError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, dateFilter, loading]);

  // Initial load
  useEffect(() => {
    loadTransactions();
  }, [filter, dateFilter]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions(true);
  }, [loadTransactions]);

  // Navigate to transaction details
  const handleTransactionPress = useCallback((item: PaymentHistoryItem) => {
    (navigation as any).navigate('TransactionDetails', {
      transactionId: item.id,
    });
  }, [navigation]);

  // Render transaction item
  const renderTransaction = useCallback(({ item }: { item: PaymentHistoryItem }) => {
    const date = new Date(item.createdAt);
    const formattedDate = format(date, 'MMM d, yyyy');
    const formattedTime = format(date, 'h:mm a');

    const statusColors: Record<string, string> = {
      completed: '#34C759',
      pending: '#FF9500',
      failed: '#FF3B30',
    };

    const statusLabels: Record<string, string> = {
      completed: 'Paid',
      pending: 'Pending',
      failed: 'Failed',
    };

    return (
      <Pressable
        style={styles.transactionItem}
        onPress={() => handleTransactionPress(item)}
      >
        <View style={styles.transactionLeft}>
          <View style={[styles.typeIcon, item.type === 'nfc' ? styles.nfcIcon : styles.qrIcon]}>
            <Text style={styles.typeIconText}>{item.type === 'nfc' ? 'NFC' : 'QR'}</Text>
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.merchantName}>{item.merchant.name}</Text>
            <Text style={styles.transactionDate}>
              {formattedDate} at {formattedTime}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <Text style={styles.amount}>
            {formatAmountUtil(item.amount, item.currency)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
            <Text style={styles.statusText}>{statusLabels[item.status]}</Text>
          </View>
        </View>
      </Pressable>
    );
  }, [handleTransactionPress]);

  // Render filter chip
  const renderFilterChip = useCallback((
    label: string,
    value: FilterType,
    currentFilter: FilterType,
    onPress: () => void
  ) => (
    <Pressable
      style={[
        styles.filterChip,
        currentFilter === value && styles.filterChipActive,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterChipText,
          currentFilter === value && styles.filterChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  ), []);

  // List header with filters
  const ListHeader = useCallback(() => (
    <View style={styles.headerSection}>
      <Text style={styles.sectionTitle}>Payment History</Text>

      {/* Status Filters */}
      <View style={styles.filterRow}>
        {renderFilterChip('All', 'all', filter, () => setFilter('all'))}
        {renderFilterChip('Completed', 'completed', filter, () => setFilter('completed'))}
        {renderFilterChip('Pending', 'pending', filter, () => setFilter('pending'))}
        {renderFilterChip('Failed', 'failed', filter, () => setFilter('failed'))}
      </View>

      {/* Date Filters */}
      <View style={styles.filterRow}>
        {renderFilterChip('All Time', 'all' as any, dateFilter as any, () => setDateFilter('all' as any))}
        {renderFilterChip('Today', 'today' as any, dateFilter as any, () => setDateFilter('today' as any))}
        {renderFilterChip('This Week', 'week' as any, dateFilter as any, () => setDateFilter('week' as any))}
        {renderFilterChip('This Month', 'month' as any, dateFilter as any, () => setDateFilter('month' as any))}
      </View>
    </View>
  ), [filter, dateFilter, renderFilterChip]);

  // List empty component
  const ListEmptyComponent = useCallback(() => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.emptyText}>Loading payments...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No Payments Found</Text>
        <Text style={styles.emptyText}>
          {filter !== 'all' || dateFilter !== 'all'
            ? 'Try adjusting your filters'
            : 'Start making payments to see your history here'}
        </Text>
      </View>
    );
  }, [loading, filter, dateFilter]);

  return (
    <View style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={transactions.length === 0 ? styles.emptyListContainer : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  headerSection: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F7',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  nfcIcon: {
    backgroundColor: '#E3F2FD',
  },
  qrIcon: {
    backgroundColor: '#F3E5F5',
  },
  typeIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
  },
  transactionInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#888',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyListContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});
