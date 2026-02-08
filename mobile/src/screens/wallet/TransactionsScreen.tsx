import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  ListRenderItem,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useWalletStore } from '@/stores';
import { TransactionListItem, FilterBar } from '@/components';
import type { RootStackParamList } from '@/navigation';
import { TransactionFilter } from '@/components/wallet';
import { Transaction } from '@/types';

interface TransactionsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Transactions'>;
  route: RouteProp<RootStackParamList, 'Transactions'>;
}

type TransactionFilterType = TransactionFilter;

const filterOptions: { label: string; value: TransactionFilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Payments', value: 'payment' },
  { label: 'P2P', value: 'p2p' },
  { label: 'Funding', value: 'fund' },
  { label: 'Withdrawals', value: 'withdraw' },
];

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  navigation,
}) => {
  const {
    transactions,
    transactionsTotal,
    transactionsHasMore,
    isLoadingTransactions,
    fetchTransactions,
    fetchMoreTransactions,
    setCurrentFilter,
    clearErrors,
  } = useWalletStore();

  const [currentFilter, setCurrentFilterLocal] =
    useState<TransactionFilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTransactions(true);
  }, []);

  const loadTransactions = async (refresh = false) => {
    try {
      await fetchTransactions({ type: currentFilter, refresh });
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearErrors();
    try {
      await loadTransactions(true);
    } finally {
      setRefreshing(false);
    }
  }, [currentFilter, fetchTransactions, clearErrors]);

  const handleFilterChange = useCallback(
    async (filter: TransactionFilterType) => {
      setCurrentFilterLocal(filter);
      setCurrentFilter(filter === 'all' ? null : filter);
      try {
        await fetchTransactions({ type: filter, refresh: true });
      } catch (error) {
        console.error('Failed to filter transactions:', error);
      }
    },
    [fetchTransactions, setCurrentFilter]
  );

  const handleTransactionPress = useCallback(
    (transactionId: string) => {
      navigation.navigate('TransactionDetails', { transactionId });
    },
    [navigation]
  );

  const handleLoadMore = useCallback(async () => {
    if (!transactionsHasMore || isLoadingTransactions) {
      return;
    }
    try {
      await fetchMoreTransactions();
    } catch (error) {
      console.error('Failed to load more transactions:', error);
    }
  }, [transactionsHasMore, isLoadingTransactions, fetchMoreTransactions]);

  const renderItem: ListRenderItem<Transaction> = useCallback(
    ({ item }) => (
      <TransactionListItem
        transaction={item}
        onPress={() => handleTransactionPress(item.id)}
      />
    ),
    [handleTransactionPress]
  );

  const renderFooter = () => {
    if (!isLoadingTransactions) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoadingTransactions) return null;

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateIcon}>💳</Text>
        <Text style={styles.emptyStateTitle}>No transactions found</Text>
        <Text style={styles.emptyStateDescription}>
          {currentFilter === 'all'
            ? "You haven't made any transactions yet"
            : `No ${currentFilter} transactions found`}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FilterBar
        filters={filterOptions}
        selectedFilter={currentFilter}
        onFilterChange={handleFilterChange}
      />

      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          transactions.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.2}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {transactionsTotal > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {transactionsTotal} {transactionsTotal === 1 ? 'transaction' : 'transactions'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 20,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  summaryBar: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9F9F9',
  },
  summaryText: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
  },
});
