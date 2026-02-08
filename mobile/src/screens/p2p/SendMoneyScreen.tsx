/**
 * SendMoneyScreen
 * Main screen for sending money to other users
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
import { useWalletStore } from '@/stores/walletStore';
import { Button, Input } from '@/components';
import { AmountInput } from '@/components/p2p';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Send'>;

export const SendMoneyScreen: React.FC<Props> = ({ navigation }) => {
  const [screen, setScreen] = useState<'amount' | 'recipient' | 'confirm' | 'note'>('recipient');

  const {
    recentContacts,
    selectedRecipient,
    sendAmount,
    sendNote,
    isSendingMoney,
    sendError,
    fetchRecentContacts,
    selectRecipient,
    setSendAmount,
    setSendNote,
    sendMoney,
    clearErrors,
    resetSendForm,
  } = useP2PStore();

  const { balance, availableBalance } = useWalletStore();
  const [localAmount, setLocalAmount] = useState(sendAmount);

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
    setLocalAmount(amount);
    setSendAmount(amount);
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (screen === 'amount') {
      if (localAmount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter an amount greater than $0.00');
        return;
      }
      if (localAmount > availableBalance) {
        Alert.alert('Insufficient Funds', `You only have $${(availableBalance / 100).toFixed(2)} available`);
        return;
      }
      setScreen('note');
    } else if (screen === 'note') {
      setScreen('confirm');
    } else if (screen === 'confirm') {
      handleSend();
    }
  };

  const handleSend = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await sendMoney();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to success screen or show modal
      Alert.alert('Success!', `$${(sendAmount / 100).toFixed(2)} sent to ${selectedRecipient?.name}`, [
        {
          text: 'Done',
          onPress: () => {
            resetSendForm();
            setLocalAmount(0);
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Failed to Send', sendError || 'Please try again');
    }
  };

  const canContinue = () => {
    if (screen === 'amount') return localAmount > 0;
    if (screen === 'recipient') return selectedRecipient !== null;
    return true;
  };

  const getContinueText = () => {
    if (screen === 'amount') return 'Add Note (Optional)';
    if (screen === 'note') return 'Review & Send';
    return `Send $${(sendAmount / 100).toFixed(2)}`;
  };

  const renderRecipientScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>Send Money</Text>
      <Text style={styles.screenSubtitle}>Choose who to pay</Text>

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

      <TouchableOpacity
        style={styles.optionItem}
        onPress={() => navigation.navigate('P2PTap' as never)}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconText}>📡</Text>
        </View>
        <Text style={styles.optionText}>Tap to Pay</Text>
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
            <Text style={styles.recipientLabel}>To</Text>
          </View>
          <Text style={styles.recipientChange}>Change</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.screenTitle}>Enter Amount</Text>
      <Text style={styles.balanceText}>
        Available: ${(availableBalance / 100).toFixed(2)}
      </Text>

      <AmountInput
        value={localAmount}
        onChange={handleAmountChange}
        maxAmount={availableBalance / 100}
        onDone={() => localAmount > 0 && handleContinue()}
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
            <Text style={styles.summaryAmount}>${(sendAmount / 100).toFixed(2)}</Text>
            <Text style={styles.summaryRecipient}>{selectedRecipient.name}</Text>
          </View>
        </View>
      )}

      <Text style={styles.screenTitle}>Add a Note</Text>
      <Text style={styles.screenSubtitle}>Optional memo for this payment</Text>

      <Input
        value={sendNote}
        onChangeText={setSendNote}
        placeholder="What's this for?"
        multiline
        numberOfLines={3}
        maxLength={500}
        style={styles.noteInput}
      />

      <View style={styles.quickNotes}>
        {['Thanks!', 'Dinner', 'Rent', 'Payback'].map((note) => (
          <TouchableOpacity
            key={note}
            style={styles.quickNoteButton}
            onPress={() => setSendNote(note)}
          >
            <Text style={styles.quickNoteText}>{note}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderConfirmScreen = () => (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>Confirm Payment</Text>

      <View style={styles.confirmCard}>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>To</Text>
          <Text style={styles.confirmValue}>{selectedRecipient?.name}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>Amount</Text>
          <Text style={styles.confirmValue}>${(sendAmount / 100).toFixed(2)}</Text>
        </View>
        <View style={styles.confirmDivider} />
        <View style={styles.confirmRow}>
          <Text style={styles.confirmLabel}>Total</Text>
          <Text style={styles.confirmTotal}>${(sendAmount / 100).toFixed(2)}</Text>
        </View>
        {sendNote && (
          <>
            <View style={styles.confirmDivider} />
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>Note</Text>
              <Text style={styles.confirmValue}>{sendNote}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.fundingInfo}>
        <Text style={styles.fundingInfoText}>
          Payment will be made from your Tap2 Wallet balance
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
            if (screen === 'confirm') setScreen('note');
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
        {screen === 'confirm' && renderConfirmScreen()}
      </ScrollView>

      {/* Continue/Send Button */}
      <View style={styles.footer}>
        {isSendingMoney ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.loadingText}>Sending...</Text>
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
  balanceText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
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
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
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
    backgroundColor: '#F0F0F0',
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
    backgroundColor: '#E8F4FF',
    borderRadius: 12,
    marginBottom: 16,
  },
  recipientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
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
    color: '#333333',
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

  // Confirm Screen
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  confirmLabel: {
    fontSize: 16,
    color: '#666666',
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  confirmTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  confirmDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  fundingInfo: {
    padding: 16,
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
  },
  fundingInfoText: {
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
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
