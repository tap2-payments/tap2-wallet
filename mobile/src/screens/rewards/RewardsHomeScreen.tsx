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
import { PointsBalanceCard, Button, LoadingSpinner } from '@/components';
import type { RootStackParamList } from '@/navigation';

interface RewardsHomeScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Rewards'>;
  route: RouteProp<RootStackParamList, 'Rewards'>;
}

const TIER_INFO = {
  bronze: {
    benefits: ['1 point per $1 spent', 'Standard offers', 'Basic support'],
    color: '#CD7F32',
  },
  silver: {
    benefits: ['1.25x points on purchases', 'Exclusive offers', 'Priority support'],
    color: '#C0C0C0',
  },
  gold: {
    benefits: ['1.5x points on purchases', 'Premium offers', 'VIP support'],
    color: '#FFD700',
  },
  platinum: {
    benefits: ['2x points on purchases', 'Exclusive access', 'Dedicated concierge'],
    color: '#E5E4E2',
  },
};

export const RewardsHomeScreen: React.FC<RewardsHomeScreenProps> = ({
  navigation,
}) => {
  const {
    points,
    earnedToDate,
    redeemedToDate,
    currencyValue,
    tier,
    pointsToNextTier,
    nextTierPoints,
    expiringPoints,
    expiresAt,
    isLoadingBalance,
    fetchBalance,
    clearErrors,
  } = useRewardsStore();

  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  useEffect(() => {
    loadBalance();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('RewardsHistory' as never)}
          style={styles.headerButton}
        >
          <Text style={styles.headerButtonText}>History</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const loadBalance = async () => {
    try {
      await fetchBalance();
    } catch (error) {
      console.error('Failed to load rewards balance:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearErrors();
    try {
      await loadBalance();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchBalance, clearErrors]);

  const handleViewHistory = () => {
    navigation.navigate('RewardsHistory' as never);
  };

  const handleViewOffers = () => {
    navigation.navigate('RewardsOffers' as never);
  };

  const handleRedeem = () => {
    navigation.navigate('RedeemRewards' as never);
  };

  const toggleBalanceVisibility = () => {
    setBalanceVisible(!balanceVisible);
  };

  const formatCurrencyValue = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const tierInfo = TIER_INFO[tier];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Points Balance Card */}
        <View style={styles.balanceSection}>
          <PointsBalanceCard
            points={points}
            tier={tier}
            currencyValue={currencyValue}
            pointsToNextTier={pointsToNextTier}
            nextTierPoints={nextTierPoints}
            expiringPoints={expiringPoints}
            expiresAt={expiresAt}
            balanceVisible={balanceVisible}
            onToggleVisibility={toggleBalanceVisibility}
            onPress={handleViewOffers}
          />
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Earned to Date</Text>
            <Text style={styles.statValue}>{points.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Redeemed</Text>
            <Text style={styles.statValue}>{redeemedToDate.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Value</Text>
            <Text style={styles.statValue}>{formatCurrencyValue(currencyValue)}</Text>
          </View>
        </View>

        {/* Tier Benefits */}
        <View style={styles.tierSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Current Tier: {tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
          </View>
          <View style={styles.tierInfoCard}>
            <View style={[styles.tierIndicator, { backgroundColor: tierInfo.color }]} />
            <View style={styles.benefitsList}>
              {tierInfo.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Text style={styles.benefitBullet}>✓</Text>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleViewOffers}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>🎁</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Browse Offers</Text>
              <Text style={styles.actionDescription}>
                Discover rewards you can redeem
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleRedeem}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>💎</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Redeem Points</Text>
              <Text style={styles.actionDescription}>
                Turn points into discounts
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleViewHistory}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionIcon}>📜</Text>
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Points History</Text>
              <Text style={styles.actionDescription}>
                Track your earnings and redemptions
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* How it works */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How Rewards Work</Text>
          <View style={styles.infoItem}>
            <View style={styles.infoNumber}>
              <Text style={styles.infoNumberText}>1</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitleText}>Earn Points</Text>
              <Text style={styles.infoDescription}>
                Get 1 point for every $1 you spend with Tap2 Wallet
              </Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoNumber}>
              <Text style={styles.infoNumberText}>2</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitleText}>Reach Tiers</Text>
              <Text style={styles.infoDescription}>
                Unlock better rates as you earn more points
              </Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoNumber}>
              <Text style={styles.infoNumberText}>3</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitleText}>Redeem Rewards</Text>
              <Text style={styles.infoDescription}>
                Exchange points for discounts and exclusive offers
              </Text>
            </View>
          </View>
        </View>

        {/* Points value banner */}
        <View style={styles.valueBanner}>
          <Text style={styles.valueBannerText}>
            💡 100 points = $1 in rewards value
          </Text>
        </View>
      </ScrollView>

      {isLoadingBalance && !refreshing && (
        <LoadingSpinner visible overlay text="Loading rewards..." />
      )}
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
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  balanceSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  statsSection: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
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
  statLabel: {
    fontSize: 11,
    color: '#999999',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
  },
  tierSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  tierInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tierIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 16,
  },
  benefitsList: {
    flex: 1,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitBullet: {
    fontSize: 14,
    color: '#34C759',
    marginRight: 8,
    fontWeight: '700',
  },
  benefitText: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  actionsSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 20,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#666666',
  },
  actionArrow: {
    fontSize: 24,
    color: '#C0C0C0',
    fontWeight: '300',
  },
  infoSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoContent: {
    flex: 1,
  },
  infoTitleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  infoDescription: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  valueBanner: {
    marginHorizontal: 24,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  valueBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#007AFF',
  },
});
