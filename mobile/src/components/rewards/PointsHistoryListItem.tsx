import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import type { PointsHistoryEntry } from '@/services/rewards.api';

export interface PointsHistoryListItemProps {
  entry: PointsHistoryEntry;
  onPress?: () => void;
}

export const PointsHistoryListItem: React.FC<PointsHistoryListItemProps> = ({
  entry,
  onPress,
}) => {
  const formatPoints = (points: number, type: PointsHistoryEntry['type']): string => {
    const sign = type === 'redeemed' || type === 'expired' ? '-' : '+';
    return `${sign}${Math.abs(points).toLocaleString()}`;
  };

  const getPointsColor = (type: PointsHistoryEntry['type']): string => {
    switch (type) {
      case 'earned':
        return '#34C759';
      case 'redeemed':
        return '#FF3B30';
      case 'expired':
        return '#8E8E93';
      case 'adjusted':
        return '#FF9500';
      default:
        return '#333333';
    }
  };

  const getIcon = (type: PointsHistoryEntry['type']): string => {
    switch (type) {
      case 'earned':
        return '✨';
      case 'redeemed':
        return '🎁';
      case 'expired':
        return '⏰';
      case 'adjusted':
        return '🔄';
      default:
        return '📍';
    }
  };

  const getTypeLabel = (type: PointsHistoryEntry['type']): string => {
    switch (type) {
      case 'earned':
        return 'Points Earned';
      case 'redeemed':
        return 'Points Redeemed';
      case 'expired':
        return 'Points Expired';
      case 'adjusted':
        return 'Points Adjusted';
      default:
        return 'Points';
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const entryDate = new Date(date);
    const diffMs = now.getTime() - entryDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return entryDate.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return entryDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getExpirationText = (): string | null => {
    if (entry.type !== 'earned' || !entry.expiresAt) return null;

    const daysUntilExpiry = Math.ceil(
      (new Date(entry.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry <= 0) return 'Expired';
    if (daysUntilExpiry <= 30) return `Expires in ${daysUntilExpiry} days`;

    return null;
  };

  const expirationText = getExpirationText();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{getIcon(entry.type)}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {entry.description || entry.merchantName || getTypeLabel(entry.type)}
            </Text>
            {entry.merchantName && entry.description && (
              <Text style={styles.description} numberOfLines={1}>
                {entry.description}
              </Text>
            )}
          </View>
          <Text
            style={[
              styles.points,
              { color: getPointsColor(entry.type) },
            ]}
          >
            {formatPoints(entry.points, entry.type)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.leftInfo}>
            <Text style={styles.date}>{formatDate(entry.createdAt)}</Text>
            {expirationText && (
              <Text style={[styles.expiration, { color: '#FF9500' }]}>
                {expirationText}
              </Text>
            )}
          </View>
          <Text style={styles.balanceAfter}>
            Balance: {entry.balanceAfter.toLocaleString()}
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
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  description: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  points: {
    fontSize: 16,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftInfo: {
    flex: 1,
  },
  date: {
    fontSize: 13,
    color: '#999999',
  },
  expiration: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  balanceAfter: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
