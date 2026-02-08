import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';

export type PaymentMethodType = 'card' | 'bank' | 'apple_pay' | 'google_pay';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  last4?: string;
  brand?: string;
  bankName?: string;
  isDefault?: boolean;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface PaymentMethodCardProps {
  method: PaymentMethod;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  showDefaultBadge?: boolean;
}

export const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  method,
  onPress,
  onLongPress,
  selected = false,
  showDefaultBadge = true,
}) => {
  const getIcon = (type: PaymentMethodType): string => {
    switch (type) {
      case 'card':
        return '💳';
      case 'bank':
        return '🏦';
      case 'apple_pay':
        return '🍎';
      case 'google_pay':
        return '🔵';
      default:
        return '💳';
    }
  };

  const getTitle = (method: PaymentMethod): string => {
    switch (method.type) {
      case 'card':
        return method.brand || 'Card';
      case 'bank':
        return method.bankName || 'Bank Account';
      case 'apple_pay':
        return 'Apple Pay';
      case 'google_pay':
        return 'Google Pay';
      default:
        return 'Payment Method';
    }
  };

  const getSubtitle = (method: PaymentMethod): string => {
    if (method.type === 'card' && method.last4) {
      const expiry =
        method.expiryMonth && method.expiryYear
          ? `${String(method.expiryMonth).padStart(2, '0')}/${String(
              method.expiryYear
            ).slice(-2)}`
          : '';
      return `•••• ${method.last4}${expiry ? ' • ' + expiry : ''}`;
    }

    if (method.type === 'bank' && method.last4) {
      return `•••• ${method.last4}`;
    }

    if (method.type === 'apple_pay') {
      return 'Connected';
    }

    if (method.type === 'google_pay') {
      return 'Connected';
    }

    return '';
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.container,
        selected && styles.selectedContainer,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.leftContainer}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{getIcon(method.type)}</Text>
        </View>
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{getTitle(method)}</Text>
            {method.isDefault && showDefaultBadge && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>Default</Text>
              </View>
            )}
          </View>
          {getSubtitle(method) ? (
            <Text style={styles.subtitle}>{getSubtitle(method)}</Text>
          ) : null}
        </View>
      </View>

      {selected && (
        <View style={styles.checkContainer}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedContainer: {
    backgroundColor: '#F0F8FF',
  },
  pressed: {
    backgroundColor: '#F5F5F5',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginRight: 8,
  },
  defaultBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34C759',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
