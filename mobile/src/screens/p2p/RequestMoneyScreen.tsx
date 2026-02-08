/**
 * RequestMoneyScreen
 * Create a payment request to another user
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { useP2PStore } from '@/stores/p2pStore';
import { Button, Input } from '@/components';
import { AmountInput } from '@/components/p2p';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Receive'>;

export const RequestMoneyScreen: React.FC<Props> = ({ navigation }) => {
  const [screen, setScreen] = useState<'recipient' | 'amount' | 'note' | 'review'>('recipient');
  const [requestAmount, setRequestAmount] = useState(0);
  const [requestNote, setRequestNote] = useState('');

  const {
    recentContacts,
    selectedRecipient,
    isCreatingRequest,
    requestError,
    fetchRecentContacts,
    selectRecipient,
    createPaymentRequest,
    clearErrors,
  } = useP2PStore();

  useEffect(() => {
    fetchRecentContacts();
  }, []);

  useEffect(() => {
    clearErrors();
  }, [screen]);

  const handleSelectRecent = (contact: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectRecipient(contact);
    setScreen('amount');
  };

  const handleAmountChange = (amount: number) => {
    setRequestAmount(amount);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (screen === 'amount') {
      if (requestAmount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter an amount greater than $0.00');
        return;
      }
      setScreen('note');
    } else if (screen === 'note') {
      setScreen('review');
    } else if (screen === 'review') {
      handleCreateRequest();
    }
  };

  const handleCreateRequest = async () => {
    if (!selectedRecipient) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      await createPaymentRequest({
        recipientId: selectedRecipient.id,
        amount: requestAmount,
        note: requestNote || undefined,
        expiresIn: 86400, // 24 hours
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Request Sent!',
        `You requested $${(requestAmount / 100).toFixed(2)} from ${selectedRecipient.name}`,
        [
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Failed to Create Request', requestError || 'Please try again');
    }
  };

  const canContinue = () => {
    if (screen === 'amount') return requestAmount > 0;
    if (screen === 'recipient') return selectedRecipient !== null;
    return true;
  };

  const getContinueText = () => {
    if (screen === 'amount') return 'Add Note (Optional)';
    if (screen === 'note') return 'Review Request';
    return 'Send Request';
  };

  const renderRecipientScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>Request Money</Text>
      <Text style={styles.screenSubtitle}>Who do you want to request from?</Text>

      {/* Recent Contacts */}
      {recentContacts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent</Text>
          {recentContacts.slice(0, 5).map((contact) => (
            <TouchableOpacity
              key={contact.id}
              style={styles.contactItem}
              onPress={() => handleSelectRecent(contact)}
            >
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {contact.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Other Options */}
      <TouchableOpacity
        style={styles.optionItem}
        onPress={() => navigation.navigate('SelectRecipient' as never)}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>👥</Text>
        </View>
        <Text style={styles.optionText}>All Contacts</Text>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.optionItem}
        onPress={() => navigation.navigate('PhoneLookup' as never)}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>📱</Text>
        </View>
        <Text style={styles.optionText}>Enter Phone Number</Text>
        <Text style={styles.optionArrow}>›</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAmountScreen = () => (
    <View style={styles.screenContainer}>
      {selectedRecipient && (
        <TouchableOpacity
          style={styles.recipientBar}
          onPress={() => setScreen('recipient')}
        >
          <View style={styles.recipientAvatar}>
            <Text style={styles.recipientAvatarText}>
              {selectedRecipient.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.recipientInfo}>
            <Text style={styles.recipientName}>{selectedRecipient.name}</Text>
            <Text style={styles.recipientLabel}>Requesting from</Text>
          </View>
          <Text style={styles.recipientChange}>Change</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.screenTitle}>Enter Amount</Text>
      <Text style={styles.screenSubtitle}>How much do you want to request?</Text>

      <AmountInput
        value={requestAmount}
        onChange={handleAmountChange}
        onDone={() => requestAmount > 0 && handleContinue()}
      />
    </View>
  );

  const renderNoteScreen = () => (
    <View style={styles.screenContainer}>
      {selectedRecipient && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryAvatar}>
            <Text style={styles.summaryAvatarText}>
              {selectedRecipient.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryAmount}>${(requestAmount / 100).toFixed(2)}</Text>
            <Text style={styles.summaryRecipient}>{selectedRecipient.name}</Text>
          </View>
        </View>
      )}

      <Text style={styles.screenTitle}>Add a Note</Text>
      <Text style={styles.screenSubtitle}>Optional memo for this request</Text>

      <Input
        value={requestNote}
        onChangeText={setRequestNote}
        placeholder="What's this for?"
        multiline
        numberOfLines={3}
        maxLength={500}
        style={styles.noteInput}
      />

      <View style={styles.quickNotes}>
        {['Rent', 'Dinner', 'Utilities', 'Other'].map((note) => (
          <TouchableOpacity
            key={note}
            style={styles.quickNoteButton}
            onPress={() => setRequestNote(note)}
          >
            <Text style={styles.quickNoteText}>{note}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderReviewScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>Review Request</Text>

      <View style={styles.reviewCard}>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Requesting from</Text>
          <Text style={styles.reviewValue}>{selectedRecipient?.name}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Amount</Text>
          <Text style={styles.reviewValue}>${(requestAmount / 100).toFixed(2)}</Text>
        </View>
        <View style={styles.reviewDivider} />
        <View style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>Total</Text>
          <Text style={styles.reviewTotal}>${(requestAmount / 100).toFixed(2)}</Text>
        </View>
        {requestNote && (
          <>
            <View style={styles.reviewDivider} />
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Note</Text>
              <Text style={styles.reviewValue}>{requestNote}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoBoxText}>
          They will receive a notification and can pay you instantly
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      {screen !== 'recipient' && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (screen === 'review') setScreen('note');
            else if (screen === 'note') setScreen('amount');
            else if (screen === 'amount') setScreen('recipient');
          }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {screen === 'recipient' && renderRecipientScreen()}
        {screen === 'amount' && renderAmountScreen()}
        {screen === 'note' && renderNoteScreen()}
        {screen === 'review' && renderReviewScreen()}
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        {isCreatingRequest ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.loadingText}>Creating request...</Text>
          </View>
        ) : (
          <Button
            title={getContinueText()}
            onPress={handleContinue}
            disabled={!canContinue()}
            fullWidth
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  backButton: {
    padding: 16,
    paddingTop: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  screenContainer: {
    padding: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
  },

  // Recipient Screen
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFA500',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  contactName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  contactArrow: {
    fontSize: 20,
    color: '#C0C0C0',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF4E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIconText: {
    fontSize: 20,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  optionArrow: {
    fontSize: 20,
    color: '#C0C0C0',
  },

  // Amount Screen
  recipientBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF4E5',
    borderRadius: 12,
    marginBottom: 16,
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFA500',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recipientAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  recipientLabel: {
    fontSize: 14,
    color: '#666666',
  },
  recipientChange: {
    fontSize: 14,
    color: '#007AFF',
  },

  // Note Screen
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
  },
  summaryAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  summaryAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
  },
  summaryInfo: {
    flex: 1,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFA500',
  },
  summaryRecipient: {
    fontSize: 14,
    color: '#666666',
  },
  noteInput: {
    marginBottom: 24,
  },
  quickNotes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickNoteButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  quickNoteText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },

  // Review Screen
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  reviewLabel: {
    fontSize: 16,
    color: '#666666',
  },
  reviewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  reviewTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFA500',
  },
  reviewDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  infoBox: {
    padding: 16,
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  infoBoxText: {
    fontSize: 14,
    color: '#666666',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FFA500',
    borderRadius: 12,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
