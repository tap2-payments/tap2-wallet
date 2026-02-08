/**
 * SplitBillScreen
 * Split a bill with multiple people
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { useP2PStore } from '@/stores/p2pStore';
import { SplitBillMember, Button, Input } from '@/components';
import type { SplitBillMember as SplitBillMemberType, Contact } from '@/types';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Send'>;

interface MemberInput {
  userId?: string;
  name: string;
  amount: number;
  avatar?: string;
  contact?: Contact;
}

export const SplitBillScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState<'details' | 'members' | 'amounts' | 'review'>('details');
  const [billTitle, setBillTitle] = useState('');
  const [billTotal, setBillTotal] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [showContactPicker, setShowContactPicker] = useState(false);

  const {
    recentContacts,
    allContacts,
    tap2Contacts,
    isCreatingSplitBill,
    splitBillError,
    fetchAllContacts,
    createSplitBill,
    setSplitBillTitle,
    setSplitBillTotal,
    setSplitBillType,
    addSplitBillMember,
    removeSplitBillMember,
    updateSplitBillMemberAmount,
    resetSplitBillForm,
    clearErrors,
  } = useP2PStore();

  useEffect(() => {
    fetchAllContacts();
  }, []);

  useEffect(() => {
    clearErrors();
  }, [step]);

  const handleAddMember = (contact: Contact) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const newMember: MemberInput = {
      userId: contact.tap2UserId || contact.recordID,
      name: `${contact.givenName} ${contact.familyName}`.trim(),
      amount: 0,
      contact,
    };

    setMembers([...members, newMember]);
    setShowContactPicker(false);

    // Update equal split amounts
    if (splitType === 'equal' && billTotal) {
      const total = parseFloat(billTotal) || 0;
      const perPerson = total / (members.length + 1);
      setMembers(members.map((m) => ({ ...m, amount: perPerson })));
    }
  };

  const handleRemoveMember = (userId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMembers = members.filter((m) => m.userId !== userId);
    setMembers(newMembers);

    // Recalculate equal split
    if (splitType === 'equal' && billTotal) {
      const total = parseFloat(billTotal) || 0;
      const perPerson = newMembers.length > 0 ? total / newMembers.length : 0;
      setMembers(newMembers.map((m) => ({ ...m, amount: perPerson })));
    }
  };

  const handleTotalChange = (text: string) => {
    const numeric = text.replace(/[^0-9.]/g, '');
    setBillTotal(numeric);

    if (splitType === 'equal' && members.length > 0) {
      const total = parseFloat(numeric) || 0;
      const perPerson = total / members.length;
      setMembers(members.map((m) => ({ ...m, amount: perPerson })));
    }
  };

  const handleMemberAmountChange = (userId: string | undefined, amount: string) => {
    if (!userId) return;

    const numeric = parseFloat(amount) || 0;
    setMembers(members.map((m) => (m.userId === userId ? { ...m, amount: numeric } : m)));
    setSplitType('custom');
  };

  const validateStep = (): boolean => {
    if (step === 'details') {
      if (!billTitle.trim()) {
        Alert.alert('Title Required', 'Please enter a title for this split bill');
        return false;
      }
      if (!billTotal || parseFloat(billTotal) <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid total amount');
        return false;
      }
      if (members.length === 0) {
        Alert.alert('Add Members', 'Please add at least one person to split with');
        return false;
      }
    }
    return true;
  };

  const handleContinue = () => {
    if (!validateStep()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (step === 'details') {
      setStep('members');
    } else if (step === 'members') {
      setStep('amounts');
    } else if (step === 'amounts') {
      setStep('review');
    } else if (step === 'review') {
      handleCreateSplitBill();
    }
  };

  const handleCreateSplitBill = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Convert to store format
      const total = parseFloat(billTotal);
      const membersTotal = members.reduce((sum, m) => sum + m.amount, 0);

      if (Math.abs(membersTotal - total) > 0.01) {
        Alert.alert(
          'Amounts Don\'t Match',
          `The member amounts ($${membersTotal.toFixed(2)}) don't match the bill total ($${total.toFixed(2)})`,
          [{ text: 'OK' }]
        );
        return;
      }

      // Set in store and create
      setSplitBillTitle(billTitle);
      setSplitBillTotal(total);
      setSplitBillType(splitType);

      for (const member of members) {
        if (member.userId) {
          addSplitBillMember({
            userId: member.userId,
            name: member.name,
            amount: Math.round(member.amount * 100),
            isPaid: false,
          });
        }
      }

      await createSplitBill();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Split Bill Created!', `${members.length} people will be notified`, [
        {
          text: 'Done',
          onPress: () => {
            resetSplitBillForm();
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Failed', splitBillError || 'Could not create split bill');
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'details': return 1;
      case 'members': return 2;
      case 'amounts': return 3;
      case 'review': return 4;
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {[1, 2, 3, 4].map((num) => (
          <View
            key={num}
            style={[
              styles.progressDot,
              num <= getStepNumber() && styles.progressDotActive,
            ]}
          >
            <Text
              style={[
                styles.progressDotText,
                num <= getStepNumber() && styles.progressDotTextActive,
              ]}
            >
              {num}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'details' && (
          <>
            <Text style={styles.screenTitle}>Split a Bill</Text>
            <Text style={styles.screenSubtitle}>Enter the bill details</Text>

            <Input
              label="Bill Title"
              value={billTitle}
              onChangeText={setBillTitle}
              placeholder="e.g., Dinner at Mario's"
              style={styles.input}
            />

            <View style={styles.input}>
              <Text style={styles.inputLabel}>Total Amount</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.amountInput}
                  value={billTotal}
                  onChangeText={handleTotalChange}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Split Type</Text>
            <View style={styles.splitTypeContainer}>
              <TouchableOpacity
                style={[styles.splitTypeButton, splitType === 'equal' && styles.splitTypeButtonActive]}
                onPress={() => {
                  setSplitType('equal');
                  if (billTotal && members.length > 0) {
                    const total = parseFloat(billTotal) || 0;
                    const perPerson = total / members.length;
                    setMembers(members.map((m) => ({ ...m, amount: perPerson })));
                  }
                }}
              >
                <Text style={styles.splitTypeIcon}>⚖️</Text>
                <Text style={styles.splitTypeLabel}>Equal Split</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.splitTypeButton, splitType === 'custom' && styles.splitTypeButtonActive]}
                onPress={() => setSplitType('custom')}
              >
                <Text style={styles.splitTypeIcon}>✏️</Text>
                <Text style={styles.splitTypeLabel}>Custom Amounts</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 'members' && (
          <>
            <Text style={styles.screenTitle}>Add People</Text>
            <Text style={styles.screenSubtitle}>Who are you splitting with?</Text>

            <View style={styles.membersList}>
              {members.map((member) => (
                <View key={member.userId} style={styles.memberItem}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.memberName}>{member.name}</Text>
                  <TouchableOpacity
                    style={styles.removeMemberButton}
                    onPress={() => handleRemoveMember(member.userId!)}
                  >
                    <Text style={styles.removeMemberText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {members.length === 0 && (
                <View style={styles.emptyMembers}>
                  <Text style={styles.emptyMembersText}>No members added yet</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.addMemberButton}
              onPress={() => setShowContactPicker(true)}
            >
              <Text style={styles.addMemberButtonText}>+ Add from Contacts</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'amounts' && (
          <>
            <Text style={styles.screenTitle}>Set Amounts</Text>
            <Text style={styles.screenSubtitle}>
              Total: ${parseFloat(billTotal || '0').toFixed(2)} • {splitType === 'equal' ? 'Equal split' : 'Custom'}
            </Text>

            <View style={styles.amountsList}>
              {members.map((member) => (
                <View key={member.userId} style={styles.amountItem}>
                  <View style={styles.amountMemberAvatar}>
                    <Text style={styles.amountMemberAvatarText}>
                      {member.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.amountMemberName}>{member.name}</Text>

                  {splitType === 'custom' ? (
                    <View style={styles.customAmountInput}>
                      <Text style={styles.customAmountSymbol}>$</Text>
                      <TextInput
                        style={styles.customAmountField}
                        value={member.amount.toFixed(2)}
                        onChangeText={(text) => handleMemberAmountChange(member.userId, text)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ) : (
                    <Text style={styles.amountDisplay}>${member.amount.toFixed(2)}</Text>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.totalSummary}>
              <Text style={styles.totalSummaryLabel}>Total</Text>
              <Text style={styles.totalSummaryValue}>${parseFloat(billTotal || '0').toFixed(2)}</Text>
            </View>
          </>
        )}

        {step === 'review' && (
          <>
            <Text style={styles.screenTitle}>Review Split Bill</Text>

            <View style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>{billTitle}</Text>
              <Text style={styles.reviewTotal}>${parseFloat(billTotal || '0').toFixed(2)}</Text>
              <Text style={styles.reviewMeta}>
                {members.length} {members.length === 1 ? 'person' : 'people'} • {splitType} split
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Members</Text>
            <View style={styles.reviewMembers}>
              {members.map((member) => (
                <View key={member.userId} style={styles.reviewMemberItem}>
                  <Text style={styles.reviewMemberName}>{member.name}</Text>
                  <Text style={styles.reviewMemberAmount}>${member.amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        {isCreatingSplitBill ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.loadingText}>Creating split bill...</Text>
          </View>
        ) : (
          <Button
            title={
              step === 'review'
                ? `Create Split Bill ($${parseFloat(billTotal || '0').toFixed(2)})`
                : 'Continue'
            }
            onPress={handleContinue}
            disabled={step === 'details' ? !billTitle || !billTotal || members.length === 0 : false}
            fullWidth
          />
        )}
      </View>

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowContactPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowContactPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Contacts</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {tap2Contacts.map((contact) => (
              <TouchableOpacity
                key={contact.recordID}
                style={styles.contactItem}
                onPress={() => handleAddMember(contact)}
              >
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {contact.givenName?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.contactName}>
                  {contact.givenName} {contact.familyName}
                </Text>
                {contact.isTap2User && (
                  <View style={styles.tap2Badge}>
                    <Text style={styles.tap2BadgeText}>Tap2</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
  },
  progressDotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  progressDotTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
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
  input: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    height: 52,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#666666',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  splitTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  splitTypeButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  splitTypeButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#E8F4FF',
  },
  splitTypeIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  splitTypeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  membersList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  memberName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  removeMemberButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeMemberText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  emptyMembers: {
    padding: 32,
    alignItems: 'center',
  },
  emptyMembersText: {
    fontSize: 14,
    color: '#999999',
  },
  addMemberButton: {
    padding: 16,
    backgroundColor: '#E8F4FF',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addMemberButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  amountsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  amountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  amountMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  amountMemberAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  amountMemberName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  customAmountInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  customAmountSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginRight: 4,
  },
  customAmountField: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    minWidth: 60,
    textAlign: 'right',
  },
  amountDisplay: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  totalSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  totalSummaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  totalSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  reviewTotal: {
    fontSize: 36,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  reviewMeta: {
    fontSize: 14,
    color: '#666666',
  },
  reviewMembers: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  reviewMemberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  reviewMemberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  reviewMemberAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
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
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalContent: {
    flex: 1,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
  tap2Badge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tap2BadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
