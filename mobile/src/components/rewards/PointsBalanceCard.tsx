import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const CARD_HEIGHT = 200;

export interface PointsBalanceCardProps {
  points: number;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  currencyValue?: number; // in cents
  pointsToNextTier?: number;
  nextTierPoints?: number;
  expiringPoints?: number;
  expiresAt?: Date;
  onPress?: () => void;
  showEyeButton?: boolean;
  balanceVisible?: boolean;
  onToggleVisibility?: () => void;
  animated?: boolean;
}

const TIER_CONFIG: Record<
  'bronze' | 'silver' | 'gold' | 'platinum',
  { colors: string[]; icon: string; label: string }
> = {
  bronze: {
    colors: ['#CD7F32', '#A0522D', '#8B4513'],
    icon: '🥉',
    label: 'Bronze',
  },
  silver: {
    colors: ['#C0C0C0', '#A8A8A8', '#909090'],
    icon: '🥈',
    label: 'Silver',
  },
  gold: {
    colors: ['#FFD700', '#FFA500', '#FF8C00'],
    icon: '🥇',
    label: 'Gold',
  },
  platinum: {
    colors: ['#E5E4E2', '#A0B2C6', '#7888A8'],
    icon: '💎',
    label: 'Platinum',
  },
};

export const PointsBalanceCard: React.FC<PointsBalanceCardProps> = ({
  points,
  tier = 'bronze',
  currencyValue = 0,
  pointsToNextTier = 0,
  nextTierPoints = 100,
  expiringPoints,
  expiresAt,
  onPress,
  showEyeButton = true,
  balanceVisible = true,
  onToggleVisibility,
  animated = true,
}) => {
  const fadeAnim = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const scaleAnim = useRef(new Animated.Value(animated ? 0.95 : 1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pointsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Shimmer animation
    const shimmerAnimation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      })
    );
    shimmerAnimation.start();

    // Points count up animation
    Animated.timing(pointsAnim, {
      toValue: points,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    return () => shimmerAnimation.stop();
  }, [animated]);

  const tierConfig = TIER_CONFIG[tier];

  const formatPoints = (value: number): string => {
    return Math.floor(value).toLocaleString();
  };

  const formatCurrencyValue = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const progressPercent = nextTierPoints > 0
    ? ((points % nextTierPoints) / nextTierPoints) * 100
    : 0;

  const getExpirationText = (): string | null => {
    if (!expiringPoints || expiringPoints === 0) return null;
    if (!expiresAt) return null;

    const daysUntilExpiry = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 0) return `${expiringPoints} pts expire today`;
    if (daysUntilExpiry === 1) return `${expiringPoints} pts expire tomorrow`;
    if (daysUntilExpiry <= 7) return `${expiringPoints} pts expire in ${daysUntilExpiry} days`;
    if (daysUntilExpiry <= 30) return `${expiringPoints} pts expire soon`;

    return null;
  };

  const expirationText = getExpirationText();

  const displayPoints = balanceVisible ? formatPoints(pointsAnim._value) : '••••';
  const displayCurrencyValue = balanceVisible ? formatCurrencyValue(currencyValue) : '••••';

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CARD_WIDTH, CARD_WIDTH],
  });

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={tierConfig.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Shimmer effect */}
          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerTranslate }],
              },
            ]}
          />

          <View style={styles.cardContent}>
            <View style={styles.topRow}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierIcon}>{tierConfig.icon}</Text>
                <Text style={styles.tierLabel}>{tierConfig.label}</Text>
              </View>
              {showEyeButton && onToggleVisibility && (
                <Pressable
                  onPress={onToggleVisibility}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.eyeIcon}>
                    {balanceVisible ? '👁' : '👁‍🗨'}
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Rewards Points</Text>
              <Text style={styles.balanceAmount}>{displayPoints}</Text>
              <Text style={styles.balanceValue}>
                {displayCurrencyValue} in rewards value
              </Text>
            </View>

            {/* Progress to next tier */}
            {pointsToNextTier > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>
                    {formatPoints(pointsToNextTier)} pts to next tier
                  </Text>
                  <Text style={styles.progressPercent}>
                    {Math.round(progressPercent)}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progressPercent}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* Expiration warning */}
            {expirationText && balanceVisible && (
              <View style={styles.expirationNotice}>
                <Text style={styles.expirationIcon}>⚠️</Text>
                <Text style={styles.expirationText}>{expirationText}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '50%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ skewX: '-15deg' }],
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tierLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 20,
  },
  balanceContainer: {
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    lineHeight: 48,
  },
  balanceValue: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  expirationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  expirationIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  expirationText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
