import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useRewardsStore } from '@/stores';
import { PointsHistoryListItem, LoadingSpinner } from '@/components';
import type { RootStackParamList } from '@/navigation';
import type { PointsHistoryEntry } from '@/services/rewards.api';

interface RewardsHistoryScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RewardsHistory'>;
  route: RouteProp<RootStackParamList, 'RewardsHistory'>;
}

const FILTER_OPTIONS: { label: string; value: PointsHistoryEntry['type'] | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Earned', value: 'earned' },
  { label: 'Redeemed', value: 'redeemed' },
  { label: 'Expired', value: 'expired' },
];

export const RewardsHistoryScreen: React.FC<RewardsHistoryScreenProps> = ({
  navigation,
}) => {
  const {
    historyEntries,
    historyTotal,
    historyHasMore,
    isLoadingHistory,
    historyError,
    fetchHistory,
    fetchMoreHistory,
    clearErrors,
  } = useRewardsStore();

  const [currentFilter, setCurrentFilter] = useState<PointsHistoryEntry['type'] | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadHistory(true);
  }, []);

  const loadHistory = async (refresh = false) => {
    try {
      await fetchHistory({
        refresh,
        type: currentFilter === 'all' ? undefined : currentFilter,
      });
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearErrors();
    try {
      await loadHistory(true);
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchHistory, clearErrors, currentFilter]);

  const handleFilterChange = async (filter: PointsHistoryEntry['type'] | 'all') => {
    setCurrentFilter(filter);
    try {
      await fetchHistory({
        refresh: true,
        type: filter === 'all' ? undefined : filter,
      });
    } catch (error) {
      console.error('Failed to filter history:', error);
    }
  };

  const handleLoadMore = async () => {
    if (!historyHasMore || loadingMore || isLoadingHistory) {
      return;
    }

    setLoadingMore(true);
    try {
      await fetchMoreHistory();
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = useCallback(
    ({ nativeEvent }: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;

      if (isCloseToBottom) {
        handleLoadMore();
      }
    },
    [historyHasMore, loadingMore, isLoadingHistory]
  );

  const getSummaryStats = () => {
    const earned = historyEntries
      .filter((e) => e.type === 'earned')
      .reduce((sum, e) => sum + e.points, 0);
    const redeemed = historyEntries
      .filter((e) => e.type === 'redeemed')
      .reduce((sum, e) => sum + Math.abs(e.points), 0);
    const expired = historyEntries
      .filter((e) => e.type === 'expired')
      .reduce((sum, e) => sum + Math.abs(e.points), 0);

    return { earned, redeemed, expired };
  };

  const stats = getSummaryStats();

  return (
    <View style={styles.container}>
      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.earned.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Earned</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.redeemedColor]}>{stats.redeemed.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Redeemed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, styles.expiredColor]}>{stats.expired.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Expired</Text>
        </View>
      </View>

      {/* Filter Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.filterChip,
              currentFilter === option.value && styles.filterChipActive,
            ]}
            onPress={() => handleFilterChange(option.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                currentFilter === option.value && styles.filterChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* History List */}
      {isLoadingHistory && historyEntries.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : historyEntries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📜</Text>
          <Text style={styles.emptyStateTitle}>No points history yet</Text>
          <Text style={styles.emptyStateDescription}>
            Start making purchases to earn points!
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onScroll={handleScroll}
          scrollEventThrottle={400}
        >
          {historyEntries.map((entry) => (
            <PointsHistoryListItem
              key={entry.id}
              entry={entry}
              onPress={() => {
                // Could navigate to detail screen in the future
              }}
            />
          ))}

          {loadingMore && (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          )}

          {!historyHasMore && historyEntries.length > 0 && (
            <View style={styles.endOfList}>
              <Text style={styles.endOfListText}>You've reached the end</Text>
            </View>
          )}

          {historyError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{historyError}</Text>
              <TouchableOpacity onPress={() => loadHistory(true)}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34C759',
    marginBottom: 2,
  },
  redeemedColor: {
    color: '#FF3B30',
  },
  expiredColor: {
    color: '#8E8E93',
  },
  statLabel: {
    fontSize: 11,
    color: '#999999',
    textTransform: 'uppercase',
  },
  filterScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#007AFF',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
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
  listContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfList: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListText: {
    fontSize: 13,
    color: '#999999',
  },
  errorContainer: {
    padding: 16,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
});
