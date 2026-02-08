import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface RewardOfferCardProps {
  id: string;
  title: string;
  description: string;
  pointsRequired: number;
  discountValue: number; // in cents
  discountType: 'fixed' | 'percentage';
  percentage?: number;
  userPoints: number;
  imageUrl?: string;
  category?: 'food' | 'shopping' | 'entertainment' | 'travel' | 'other';
  expiresAt?: Date;
  isAvailable?: boolean;
  onPress?: () => void;
  onRedeem?: () => void;
}

const CATEGORY_CONFIG: Record<
  'food' | 'shopping' | 'entertainment' | 'travel' | 'other' | undefined,
  { icon: string; color: string; gradient: string[] }
> = {
  food: {
    icon: '🍔',
    color: '#FF6B6B',
    gradient: ['#FF6B6B', '#FF8E53'],
  },
  shopping: {
    icon: '🛍️',
    color: '#4ECDC4',
    gradient: ['#4ECDC4', '#44A08D'],
  },
  entertainment: {
    icon: '🎬',
    color: '#A855F7',
    gradient: ['#A855F7', '#7C3AED'],
  },
  travel: {
    icon: '✈️',
    color: '#3B82F6',
    gradient: ['#3B82F6', '#2563EB'],
  },
  other: {
    icon: '🎁',
    color: '#F59E0B',
    gradient: ['#F59E0B', '#D97706'],
  },
  undefined: {
    icon: '🎁',
    color: '#F59E0B',
    gradient: ['#F59E0B', '#D97706'],
  },
};

export const RewardOfferCard: React.FC<RewardOfferCardProps> = ({
  id,
  title,
  description,
  pointsRequired,
  discountValue,
  discountType,
  percentage,
  userPoints,
  imageUrl,
  category,
  expiresAt,
  isAvailable = true,
  onPress,
  onRedeem,
}) => {
  const categoryConfig = CATEGORY_CONFIG[category];
  const canRedeem = userPoints >= pointsRequired && isAvailable;

  const formatDiscount = (): string => {
    if (discountType === 'percentage' && percentage) {
      return `${percentage}% off`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(discountValue / 100);
  };

  const formatPoints = (points: number): string => {
    return points.toLocaleString();
  };

  const getExpirationText = (): string | null => {
    if (!expiresAt) return null;

    const daysUntilExpiry = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 0) return 'Expired';
    if (daysUntilExpiry === 1) return 'Expires tomorrow';
    if (daysUntilExpiry <= 7) return `Expires in ${daysUntilExpiry} days`;
    if (daysUntilExpiry <= 30) return `Expires in ${daysUntilExpiry} days`;

    return null;
  };

  const expirationText = getExpirationText();
  const isExpired = expirationText === 'Expired';

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  const handleRedeemPress = () => {
    if (canRedeem && onRedeem) {
      onRedeem();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
        !isAvailable && styles.disabledContainer,
      ]}
      disabled={!isAvailable || isExpired}
    >
      {/* Category badge */}
      <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.color }]}>
        <Text style={styles.categoryIcon}>{categoryConfig.icon}</Text>
      </View>

      {/* Offer image or gradient placeholder */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <LinearGradient
          colors={categoryConfig.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.imagePlaceholder}
        >
          <Text style={styles.placeholderIcon}>{categoryConfig.icon}</Text>
        </LinearGradient>
      )}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {expirationText && (
            <Text
              style={[
                styles.expirationText,
                isExpired && styles.expiredText,
              ]}
            >
              {expirationText}
            </Text>
          )}
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>

        {/* Discount badge */}
        <View style={styles.discountBadge}>
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.discountGradient}
          >
            <Text style={styles.discountText}>{formatDiscount()}</Text>
          </LinearGradient>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.pointsContainer}>
            <Text style={styles.pointsLabel}>Points Required</Text>
            <Text style={styles.pointsValue}>{formatPoints(pointsRequired)}</Text>
          </View>

          {/* Redeem button */}
          <Pressable
            onPress={handleRedeemPress}
            style={({ pressed }) => [
              styles.redeemButton,
              !canRedeem && styles.disabledButton,
              pressed && canRedeem && styles.redeemButtonPressed,
            ]}
            disabled={!canRedeem || isExpired}
          >
            <Text
              style={[
                styles.redeemButtonText,
                !canRedeem && styles.disabledButtonText,
              ]}
            >
              {isExpired
                ? 'Expired'
                : !isAvailable
                ? 'Unavailable'
                : !canRedeem
                ? 'Not Enough Points'
                : 'Redeem'}
            </Text>
          </Pressable>
        </View>

        {/* Points progress if not enough points */}
        {!canRedeem && !isExpired && isAvailable && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min((userPoints / pointsRequired) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {formatPoints(pointsRequired - userPoints)} more points needed
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.9,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  categoryIcon: {
    fontSize: 18,
  },
  image: {
    width: '100%',
    height: 120,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginRight: 8,
  },
  expirationText: {
    fontSize: 11,
    color: '#FF9500',
    fontWeight: '500',
  },
  expiredText: {
    color: '#FF3B30',
  },
  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  discountBadge: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  discountGradient: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  discountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsContainer: {
    flex: 1,
  },
  pointsLabel: {
    fontSize: 11,
    color: '#999999',
    marginBottom: 2,
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  redeemButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  redeemButtonPressed: {
    opacity: 0.8,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  redeemButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButtonText: {
    color: '#999999',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: '#999999',
  },
});
