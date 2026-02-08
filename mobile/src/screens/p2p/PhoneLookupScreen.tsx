/**
 * PhoneLookupScreen
 * Enter phone number to find Tap2 user
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { p2pApi } from '@/services/p2p.api';
import { useP2PStore } from '@/stores/p2pStore';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Transfer'>;

export const PhoneLookupScreen: React.FC<Props> = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<{
    userId: string;
    name: string;
    avatar?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { selectRecipient } = useP2PStore();

  const formatPhoneNumber = (input: string) => {
    // Remove all non-digits
    const cleaned = input.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
    setError(null);
    setFoundUser(null);
  };

  const handleSearch = async () => {
    const cleaned = phoneNumber.replace(/\D/g, '');

    if (cleaned.length < 10) {
      setError('Please enter a valid phone number');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Add +1 for US numbers
      const normalized = `+1${cleaned.slice(-10)}`;
      const result = await p2pApi.lookupUserByPhone(normalized);

      if (result && result.isTap2User) {
        setFoundUser(result);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError('This phone number is not associated with a Tap2 account');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (err) {
      setError('User not found on Tap2');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = () => {
    if (foundUser) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      selectRecipient({
        id: foundUser.userId,
        name: foundUser.name,
        phone: phoneNumber,
        isTap2User: true,
      });

      navigation.goBack();
    }
  };

  const handleInvite = () => {
    Alert.alert(
      'Invite to Tap2',
      'Share your invite link with this person so they can join Tap2 Wallet!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Share',
          onPress: () => {
            // TODO: Implement share functionality
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          },
        },
      ]
    );
  };

  const isValid = phoneNumber.replace(/\D/g, '').length >= 10;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send to Phone</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Phone Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <TextInput
            style={styles.phoneInput}
            value={phoneNumber}
            onChangeText={handlePhoneChange}
            placeholder="(555) 123-4567"
            placeholderTextColor="#CCCCCC"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoFocus
            maxLength={14}
            onSubmitEditing={isValid ? handleSearch : undefined}
          />
        </View>

        {/* Search Button */}
        <TouchableOpacity
          style={[styles.searchButton, !isValid && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!isValid || isSearching}
        >
          {isSearching ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.searchButtonText}>Find User</Text>
          )}
        </TouchableOpacity>

        {/* Result */}
        {foundUser && (
          <TouchableOpacity
            style={styles.userCard}
            onPress={handleSelectUser}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {foundUser.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{foundUser.name}</Text>
              <Text style={styles.userPhone}>{phoneNumber}</Text>
            </View>
            <View style={styles.userBadge}>
              <Text style={styles.userBadgeText}>Tap2</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Error / Not Found State */}
        {error && !foundUser && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>📱</Text>
            <Text style={styles.errorTitle}>Not on Tap2</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.inviteButton} onPress={handleInvite}>
              <Text style={styles.inviteButtonText}>Invite to Tap2</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Info */}
        {!foundUser && !error && (
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Enter a phone number to find if they're on Tap2 Wallet
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cancelButton: {
    minWidth: 60,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  headerSpacer: {
    minWidth: 60,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  phoneInput: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#E0E0E0',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  searchButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: '#666666',
  },
  userBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  userBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  inviteButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 24,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoContainer: {
    marginTop: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
});
