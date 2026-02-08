import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useWalletStore } from '@/stores';
import { BalanceCard, TransactionListItem, FilterBar } from '@/components';
import type { RootStackParamList } from '@/navigation';
import { TransactionFilter } from '@/components/wallet';

interface WalletHomeScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WalletHome'>;
  route: RouteProp<RootStackParamList, 'WalletHome'>;
}

type TransactionFilterType = TransactionFilter;

const filterOptions: { label: string; value: TransactionFilterType }[] = [
  { label: 'All', value: 'all' },
  { label: 'Payments', value: 'payment' },
  { label: 'P2P', value: 'p2p' },
  { label: 'Funding', value: 'fund' },
  { label: 'Withdrawals', value: 'withdraw' },
];

export const WalletHomeScreen: React.FC<WalletHomeScreenProps> = ({
  navigation,
}) => {
  const {
    balance,
    currency,
    balanceVisible,
    transactions,
    transactionsTotal,
    transactionsHasMore,
    isLoadingBalance,
    isLoadingTransactions,
    fetchBalance,
    fetchTransactions,
    fetchMoreTransactions,
    setBalanceVisible,
    setCurrentFilter,
    clearErrors,
  } = useWalletStore();

  const [currentFilter, setCurrentFilterLocal] =
    useState<TransactionFilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('FundingSources')}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>•••</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const loadData = async () => {
    try {
      await Promise.all([fetchBalance(), fetchTransactions({ refresh: true })]);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearErrors();
    try {
      await loadData();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBalance, fetchTransactions, clearErrors]);

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

  const handleLoadMore = useCallback(async () => {
    if (!transactionsHasMore || loadingMore || isLoadingTransactions) {
      return;
    }

    setLoadingMore(true);
    try {
      await fetchMoreTransactions();
    } catch (error) {
      console.error('Failed to load more transactions:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [
    transactionsHasMore,
    loadingMore,
    isLoadingTransactions,
    fetchMoreTransactions,
  ]);

  const handleTransactionPress = useCallback(
    (transactionId: string) => {
      navigation.navigate('TransactionDetails', { transactionId });
    },
    [navigation]
  );

  const handleAddMoney = () => {
    navigation.navigate('FundWallet');
  };

  const handleWithdraw = () => {
    navigation.navigate('Withdraw');
  };

  const handleToggleBalanceVisibility = () => {
    setBalanceVisible(!balanceVisible);
  };

  const handleRewards = () => {
    navigation.navigate('Rewards' as never);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } =
            nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 100;

          if (isCloseToBottom) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {/* Balance Card */}
        <View style={styles.balanceSection}>
          <BalanceCard
            balance={balance}
            currency={currency}
            balanceVisible={balanceVisible}
            onToggleVisibility={handleToggleBalanceVisibility}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleAddMoney}
            >
              <View style={styles.actionIconContainer}>
                <Text style={styles.actionIcon}>➕</Text>
              </View>
              <Text style={styles.actionLabel}>Add Money</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleWithdraw}
            >
              <View style={styles.actionIconContainer}>
                <Text style={styles.actionIcon}>🏦</Text>
              </View>
              <Text style={styles.actionLabel}>Withdraw</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleRewards}
            >
              <View style={styles.actionIconContainer}>
                <Text style={styles.actionIcon}>🎁</Text>
              </View>
              <Text style={styles.actionLabel}>Rewards</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => Alert.alert('Coming Soon', 'Tap to Pay feature coming soon!')}
            >
              <View style={styles.actionIconContainer}>
                <Text style={styles.actionIcon}>📱</Text>
              </View>
              <Text style={styles.actionLabel}>Tap to Pay</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions Section */}
        <View style={styles.transactionsSection}>
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsTitle}>Transactions</Text>
            {transactionsTotal > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('Transactions')}
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            )}
          </View>

          <FilterBar
            filters={filterOptions}
            selectedFilter={currentFilter}
            onFilterChange={handleFilterChange}
          />

          {isLoadingTransactions && transactions.length === 0 ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>💳</Text>
              <Text style={styles.emptyStateTitle}>No transactions yet</Text>
              <Text style={styles.emptyStateDescription}>
                Add money to your wallet to get started
              </Text>
              <TouchableOpacity
                style={styles.emptyStateButton}
                onPress={handleAddMoney}
              >
                <Text style={styles.emptyStateButtonText}>Add Money</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((transaction) => (
                <TransactionListItem
                  key={transaction.id}
                  transaction={transaction}
                  onPress={() => handleTransactionPress(transaction.id)}
                />
              ))}

              {loadingMore && (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#007AFF" />
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButtonText: {
    fontSize: 20,
    color: '#007AFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
  },
  balanceSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  actionsSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'center',
  },
  transactionsSection: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  transactionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  centerContent: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  transactionsList: {
    paddingBottom: 20,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
