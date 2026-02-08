import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useRewardsStore } from '@/stores';
import { RewardOfferCard, LoadingSpinner } from '@/components';
import type { RootStackParamList } from '@/navigation';
import type { RewardOffer } from '@/services/rewards.api';

interface RewardsOffersScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RewardsOffers'>;
  route: RouteProp<RootStackParamList, 'RewardsOffers'>;
}

const CATEGORY_OPTIONS: { label: string; value: RewardOffer['category'] | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Food', value: 'food' },
  { label: 'Shopping', value: 'shopping' },
  { label: 'Entertainment', value: 'entertainment' },
  { label: 'Travel', value: 'travel' },
];

const SORT_OPTIONS = [
  { label: 'Points: Low to High', value: 'points_asc' },
  { label: 'Points: High to Low', value: 'points_desc' },
  { label: 'Value: Best First', value: 'value_desc' },
  { label: 'Expiring Soon', value: 'expiring' },
];

export const RewardsOffersScreen: React.FC<RewardsOffersScreenProps> = ({
  navigation,
}) => {
  const {
    points,
    offers,
    isLoadingOffers,
    offersError,
    fetchOffers,
    clearErrors,
  } = useRewardsStore();

  const [currentCategory, setCurrentCategory] = useState<RewardOffer['category'] | 'all'>('all');
  const [currentSort, setCurrentSort] = useState('points_asc');
  const [refreshing, setRefreshing] = useState(false);
  const [filteredOffers, setFilteredOffers] = useState<RewardOffer[]>([]);

  useEffect(() => {
    loadOffers();
  }, []);

  useEffect(() => {
    filterAndSortOffers();
  }, [offers, currentCategory, currentSort]);

  const loadOffers = async () => {
    try {
      await fetchOffers();
    } catch (error) {
      console.error('Failed to load offers:', error);
    }
  };

  const filterAndSortOffers = () => {
    let filtered = [...offers];

    // Filter by category
    if (currentCategory !== 'all') {
      filtered = filtered.filter((offer) => offer.category === currentCategory);
    }

    // Only show available offers
    filtered = filtered.filter((offer) => offer.isAvailable);

    // Sort
    switch (currentSort) {
      case 'points_asc':
        filtered.sort((a, b) => a.pointsRequired - b.pointsRequired);
        break;
      case 'points_desc':
        filtered.sort((a, b) => b.pointsRequired - a.pointsRequired);
        break;
      case 'value_desc':
        filtered.sort((a, b) => {
          const aRatio = a.discountType === 'percentage' && a.percentage ? a.percentage : a.discountValue / 100;
          const bRatio = b.discountType === 'percentage' && b.percentage ? b.percentage : b.discountValue / 100;
          return (bRatio / b.pointsRequired) - (aRatio / a.pointsRequired);
        });
        break;
      case 'expiring':
        filtered.sort((a, b) => {
          if (!a.expiresAt) return 1;
          if (!b.expiresAt) return -1;
          return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
        });
        break;
    }

    setFilteredOffers(filtered);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearErrors();
    try {
      await loadOffers();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchOffers, clearErrors]);

  const handleRedeem = (offer: RewardOffer) => {
    navigation.navigate('RedeemRewards' as never, { offerId: offer.id } as never);
  };

  const handleOfferPress = (offer: RewardOffer) => {
    // Show offer details modal or navigate to details
    Alert.alert(
      offer.title,
      offer.description + '\n\n' + offer.terms.join('\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: () => handleRedeem(offer),
          style: points >= offer.pointsRequired ? 'default' : 'cancel',
        },
      ]
    );
  };

  const getAffordableCount = () => {
    return offers.filter((offer) => offer.isAvailable && points >= offer.pointsRequired).length;
  };

  const affordableCount = getAffordableCount();

  return (
    <View style={styles.container}>
      {/* Points Banner */}
      <View style={styles.pointsBanner}>
        <Text style={styles.pointsBannerLabel}>Your Points</Text>
        <Text style={styles.pointsBannerValue}>{points.toLocaleString()}</Text>
        {affordableCount > 0 && (
          <Text style={styles.pointsBannerHint}>
            You can redeem {affordableCount} offer{affordableCount > 1 ? 's' : ''}!
          </Text>
        )}
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.filterChip,
              currentCategory === option.value && styles.filterChipActive,
            ]}
            onPress={() => setCurrentCategory(option.value)}
          >
            <Text
              style={[
                styles.filterChipText,
                currentCategory === option.value && styles.filterChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort Options */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sortScroll}
        contentContainerStyle={styles.sortContent}
      >
        {SORT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.sortChip,
              currentSort === option.value && styles.sortChipActive,
            ]}
            onPress={() => setCurrentSort(option.value)}
          >
            <Text
              style={[
                styles.sortChipText,
                currentSort === option.value && styles.sortChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Offers List */}
      <ScrollView
        style={styles.offersScroll}
        contentContainerStyle={styles.offersContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoadingOffers ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading offers...</Text>
          </View>
        ) : filteredOffers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🎁</Text>
            <Text style={styles.emptyStateTitle}>No offers available</Text>
            <Text style={styles.emptyStateDescription}>
              {currentCategory !== 'all'
                ? `No ${currentCategory} offers available right now`
                : 'Check back soon for new rewards!'}
            </Text>
            {currentCategory !== 'all' && (
              <TouchableOpacity onPress={() => setCurrentCategory('all')}>
                <Text style={styles.clearFilterText}>View All Offers</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.resultsCount}>
              {filteredOffers.length} offer{filteredOffers.length !== 1 ? 's' : ''} available
            </Text>

            {filteredOffers.map((offer) => (
              <RewardOfferCard
                key={offer.id}
                {...offer}
                userPoints={points}
                onPress={() => handleOfferPress(offer)}
                onRedeem={() => handleRedeem(offer)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {offersError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{offersError}</Text>
          <TouchableOpacity onPress={() => loadOffers()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  pointsBanner: {
    backgroundColor: '#FFD700',
    padding: 16,
    alignItems: 'center',
  },
  pointsBannerLabel: {
    fontSize: 12,
    color: '#8B6914',
    marginBottom: 2,
  },
  pointsBannerValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 2,
  },
  pointsBannerHint: {
    fontSize: 12,
    color: '#8B6914',
  },
  filterScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
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
  sortScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  sortContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  sortChipActive: {
    backgroundColor: '#E8F4FF',
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666666',
  },
  sortChipTextActive: {
    color: '#007AFF',
  },
  offersScroll: {
    flex: 1,
  },
  offersContent: {
    padding: 16,
  },
  centerContent: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
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
    marginBottom: 16,
  },
  clearFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  resultsCount: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    flex: 1,
    marginRight: 12,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
});
