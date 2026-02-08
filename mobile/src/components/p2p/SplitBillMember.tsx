/**
 * SplitBillMember Component
 * Displays a member in the split bill with their amount
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, TextInput } from 'react-native';
import type { SplitBillMember, Contact } from '@/types';

export interface SplitBillMemberProps {
  member: SplitBillMember;
  editable?: boolean;
  onRemove?: (userId: string) => void;
  onAmountChange?: (userId: string, amount: number) => void;
  style?: any;
}

export const SplitBillMember: React.FC<SplitBillMemberProps> = ({
  member,
  editable = false,
  onRemove,
  onAmountChange,
  style,
}) => {
  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  return (
    <View style={[styles.container, style]}>
      {/* Avatar */}
      <View style={styles.avatar}>
        {member.avatar ? (
          <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>
            {member.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </Text>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {member.name}
        </Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Amount:</Text>
          {editable && onAmountChange ? (
            <TextInput
              style={styles.amountInput}
              value={formatCurrency(member.amount)}
              onChangeText={(text) => {
                const amount = parseFloat(text.replace('$', '')) || 0;
                onAmountChange(member.userId || '', amount);
              }}
              keyboardType="decimal-pad"
            />
          ) : (
            <Text style={[styles.amount, member.isPaid && styles.paidAmount]}>
              {formatCurrency(member.amount)}
            </Text>
          )}
        </View>
      </View>

      {/* Status Badge */}
      {member.isPaid && (
        <View style={styles.paidBadge}>
          <Text style={styles.paidBadgeText}>Paid</Text>
        </View>
      )}

      {/* Remove Button */}
      {editable && onRemove && member.userId && (
        <Pressable
          style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}
          onPress={() => onRemove(member.userId!)}
        >
          <Text style={styles.removeButtonText}>✕</Text>
        </Pressable>
      )}
    </View>
  );
};

// Compact version for lists
export interface SplitBillMemberCompactProps {
  member: SplitBillMember;
  onPress?: (member: SplitBillMember) => void;
  style?: any;
}

export const SplitBillMemberCompact: React.FC<SplitBillMemberCompactProps> = ({
  member,
  onPress,
  style,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.compactContainer, pressed && styles.compactPressed, style]}
      onPress={() => onPress?.(member)}
    >
      <View style={styles.compactAvatar}>
        {member.avatar ? (
          <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.compactAvatarText}>
            {member.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </Text>
        )}
      </View>

      <View style={styles.compactInfo}>
        <Text style={styles.compactName} numberOfLines={1}>
          {member.name}
        </Text>
        <Text style={styles.compactAmount}>${member.amount.toFixed(2)}</Text>
      </View>

      {member.isPaid && (
        <View style={styles.compactPaidBadge}>
          <Text style={styles.compactPaidText}>✓</Text>
        </View>
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
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666666',
    marginRight: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  paidAmount: {
    color: '#34C759',
  },
  amountInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    minWidth: 80,
  },
  paidBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  paidBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34C759',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeButtonPressed: {
    opacity: 0.7,
  },
  removeButtonText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  compactPressed: {
    backgroundColor: '#F5F5F5',
  },
  compactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  compactInfo: {
    flex: 1,
  },
  compactName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333333',
  },
  compactAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  compactPaidBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactPaidText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
