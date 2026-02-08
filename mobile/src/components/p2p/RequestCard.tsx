/**
 * RequestCard Component
 * Displays a payment request card with accept/decline actions
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import type { PaymentRequest } from '@/types';

export interface RequestCardProps {
  request: PaymentRequest;
  type: 'incoming' | 'outgoing';
  onAccept?: (requestId: string) => void;
  onDecline?: (requestId: string) => void;
  onCancel?: (requestId: string) => void;
  onPress?: (request: PaymentRequest) => void;
  style?: any;
}

export const RequestCard: React.FC<RequestCardProps> = ({
  request,
  type,
  onAccept,
  onDecline,
  onCancel,
  onPress,
  style,
}) => {
  const isExpired = new Date(request.expiresAt) < new Date();
  const isPending = request.status === 'pending';

  const formatCurrency = (amount: number) => {
    return `${request.currency === 'USD' ? '$' : ''}${(amount / 100).toFixed(2)}`;
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusColor = () => {
    switch (request.status) {
      case 'pending':
        return '#FFA500';
      case 'accepted':
        return '#34C759';
      case 'declined':
        return '#FF3B30';
      case 'expired':
        return '#8E8E93';
      default:
        return '#8E8E93';
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed, style]}
      onPress={() => onPress?.(request)}
    >
      {/* Avatar */}
      <View style={styles.avatar}>
        {request.fromUserAvatar ? (
          <Image source={{ uri: request.fromUserAvatar }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>
            {request.fromUserName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {request.fromUserName}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {request.status}
            </Text>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amount}>
            {type === 'incoming' ? 'Requesting ' : 'You requested '}
            <Text style={styles.amountValue}>{formatCurrency(request.amount)}</Text>
          </Text>
        </View>

        {request.note && (
          <Text style={styles.note} numberOfLines={1}>
            "{request.note}"
          </Text>
        )}

        <Text style={styles.timestamp}>
          {isExpired ? 'Expired' : getTimeAgo(request.createdAt)}
        </Text>
      </View>

      {/* Action Buttons (only for pending incoming requests) */}
      {type === 'incoming' && isPending && !isExpired && (
        <View style={styles.actions}>
          {onDecline && (
            <Pressable
              style={({ pressed }) => [
                styles.declineButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => onDecline(request.id)}
            >
              <Text style={styles.declineButtonText}>✕</Text>
            </Pressable>
          )}
          {onAccept && (
            <Pressable
              style={({ pressed }) => [
                styles.acceptButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => onAccept(request.id)}
            >
              <Text style={styles.acceptButtonText}>✓</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Cancel Button (for pending outgoing requests) */}
      {type === 'outgoing' && isPending && !isExpired && onCancel && (
        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => onCancel(request.id)}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  pressed: {
    backgroundColor: '#F5F5F5',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
  },
  info: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginRight: 8,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  amountRow: {
    marginBottom: 2,
  },
  amount: {
    fontSize: 15,
    color: '#666666',
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333333',
  },
  note: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 8,
    gap: 8,
  },
  declineButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '600',
  },
  acceptButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginLeft: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
