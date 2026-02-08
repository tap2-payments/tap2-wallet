import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '@/stores';
import { Button, Input, PaymentMethodCard } from '@/components';
import type { RootStackParamList } from '@/navigation';

interface WithdrawScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Withdraw'>;
  route: RouteProp<RootStackParamList, 'Withdraw'>;
}

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000]; // in cents: $10, $25, $50, $100

type WithdrawType = 'instant' | 'standard';

interface WithdrawOption {
  type: WithdrawType;
  label: string;
  description: string;
  fee: number; // in percentage
  timeframe: string;
}

const WITHDRAW_OPTIONS: WithdrawOption[] = [
  {
    type: 'instant',
    label: 'Instant',
    description: 'Get your money immediately',
    fee: 1.5,
    timeframe: 'Instant',
  },
  {
    type: 'standard',
    label: 'Standard',
    description: 'Free bank transfer',
    fee: 0,
    timeframe: '1-2 business days',
  },
];

export const WithdrawScreen: React.FC<WithdrawScreenProps> = ({
  navigation,
}) => {
  const {
    balance,
    availableBalance,
    fundingMethods,
    defaultFundingMethodId,
    isLoadingFundingMethods,
    isWithdrawing,
    fetchFundingMethods,
    withdraw,
  } = useWalletStore();

  const [amount, setAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(
    null
  );
  const [withdrawType, setWithdrawType] = useState<WithdrawType>('standard');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);

  useEffect(() => {
    loadFundingMethods();
  }, []);

  useEffect(() => {
    // For withdrawals, use bank accounts only, filter by type='bank'
    const bankAccounts = fundingMethods.filter((m) => m.type === 'bank');
    if (bankAccounts.length > 0 && !selectedMethodId) {
      setSelectedMethodId(
        defaultFundingMethodId &&
          fundingMethods.find((m) => m.id === defaultFundingMethodId)?.type ===
            'bank'
          ? defaultFundingMethodId
          : bankAccounts[0].id
      );
    }
  }, [fundingMethods, defaultFundingMethodId, selectedMethodId]);

  const loadFundingMethods = async () => {
    try {
      await fetchFundingMethods();
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to load bank accounts. Please try again.'
      );
    }
  };

  const formatCurrency = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const parseAmount = (value: string): number => {
    const cleanValue = value.replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  };

  const handlePresetAmount = useCallback((cents: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount(formatCurrency(cents).replace('$', ''));
    setAmountError(null);
  }, []);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setAmountError(null);
  };

  const calculateFee = (amountInCents: number): number => {
    if (withdrawType === 'instant') {
      return Math.round(amountInCents * 0.015); // 1.5% fee
    }
    return 0;
  };

  const validateInputs = (): boolean => {
    let isValid = true;

    const amountInCents = parseAmount(amount);

    if (amountInCents < 100) {
      setAmountError('Minimum withdrawal is $1.00');
      isValid = false;
    } else if (amountInCents > availableBalance) {
      setAmountError('Amount exceeds available balance');
      isValid = false;
    }

    const bankAccounts = fundingMethods.filter((m) => m.type === 'bank');
    if (bankAccounts.length === 0) {
      setMethodError('No bank account available for withdrawal');
      isValid = false;
    } else if (!selectedMethodId) {
      setMethodError('Please select a bank account');
      isValid = false;
    } else {
      setMethodError(null);
    }

    return isValid;
  };

  const handleWithdraw = async () => {
    if (!validateInputs()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const amountInCents = parseAmount(amount);
    const fee = calculateFee(amountInCents);
    const total = amountInCents - fee;

    const message =
      fee > 0
        ? `Withdraw ${formatCurrency(amountInCents)}?\n\nFee: ${formatCurrency(
            fee
          )}\nYou'll receive: ${formatCurrency(total)}\n\nArrival: ${
            WITHDRAW_OPTIONS.find((o) => o.type === withdrawType)?.timeframe
          }`
        : `Withdraw ${formatCurrency(amountInCents)}?\n\nFee: Free\nYou'll receive: ${formatCurrency(
            total
          )}\n\nArrival: ${
            WITHDRAW_OPTIONS.find((o) => o.type === withdrawType)?.timeframe
          }`;

    Alert.alert('Confirm Withdrawal', message, [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Withdraw',
        onPress: async () => {
          try {
            await withdraw({
              amount: amountInCents,
              destination: selectedMethodId!,
              type: withdrawType,
            });

            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );

            Alert.alert(
              'Withdrawal Initiated',
              `Your withdrawal of ${formatCurrency(
                amountInCents
              )} has been initiated. ${
                withdrawType === 'instant'
                  ? 'The funds should arrive instantly.'
                  : 'The funds should arrive in 1-2 business days.'
              }`,
              [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]
            );
          } catch (error) {
            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error
            );
            Alert.alert(
              'Withdrawal Failed',
              error instanceof Error ? error.message : 'Please try again'
            );
          }
        },
      },
    ]);
  };

  const handleAddBankAccount = () => {
    navigation.navigate('AddPaymentMethod', { type: 'bank' });
  };

  const bankAccounts = fundingMethods.filter((m) => m.type === 'bank');
  const amountInCents = parseAmount(amount);
  const fee = calculateFee(amountInCents);
  const totalAmount = amountInCents > 0 ? amountInCents - fee : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            {formatCurrency(availableBalance)}
          </Text>
        </View>

        {/* Amount Input Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal Amount</Text>

          <Input
            label="Amount"
            value={amount}
            onChangeText={handleAmountChange}
            placeholder="0.00"
            keyboardType="decimal-pad"
            error={amountError}
            leftIcon={<Text style={styles.currencySymbol}>$</Text>}
          />

          {/* Preset Amounts */}
          <View style={styles.presetsContainer}>
            <Text style={styles.presetsLabel}>Quick amounts</Text>
            <View style={styles.presetsRow}>
              {PRESET_AMOUNTS.map((cents) => (
                <Button
                  key={cents}
                  title={formatCurrency(cents)}
                  variant="outline"
                  size="small"
                  onPress={() => handlePresetAmount(cents)}
                  style={styles.presetButton}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Withdrawal Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal Speed</Text>

          {WITHDRAW_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.withdrawTypeOption,
                withdrawType === option.type && styles.selectedOption,
              ]}
              onPress={() => {
                setWithdrawType(option.type);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.optionLeft}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDescription}>
                  {option.description}
                </Text>
              </View>
              <View style={styles.optionRight}>
                {option.fee > 0 ? (
                  <Text style={styles.feeText}>{option.fee}% fee</Text>
                ) : (
                  <Text style={styles.feeText}>Free</Text>
                )}
                <Text style={styles.timeframeText}>{option.timeframe}</Text>
              </View>
              <View
                style={[
                  styles.radioButton,
                  withdrawType === option.type && styles.radioSelected,
                ]}
              >
                {withdrawType === option.type && (
                  <View style={styles.radioDot} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Destination Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Destination</Text>
            <Button
              title="+ Add Bank"
              variant="ghost"
              size="small"
              onPress={handleAddBankAccount}
            />
          </View>

          {methodError && (
            <Text style={styles.errorText}>{methodError}</Text>
          )}

          {isLoadingFundingMethods ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : bankAccounts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🏦</Text>
              <Text style={styles.emptyStateTitle}>No bank accounts</Text>
              <Text style={styles.emptyStateDescription}>
                Add a bank account to withdraw funds
              </Text>
              <Button
                title="Add Bank Account"
                onPress={handleAddBankAccount}
              />
            </View>
          ) : (
            <View style={styles.methodsList}>
              {bankAccounts.map((method) => (
                <PaymentMethodCard
                  key={method.id}
                  method={method}
                  selected={selectedMethodId === method.id}
                  onPress={() => {
                    setSelectedMethodId(method.id);
                    setMethodError(null);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  showDefaultBadge={false}
                />
              ))}
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            Withdrawals are processed instantly for instant transfers, or 1-2
            business days for standard transfers.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>You'll receive</Text>
          <Text style={styles.summaryAmount}>
            {formatCurrency(totalAmount)}
          </Text>
        </View>
        {fee > 0 && (
          <Text style={styles.feeNote}>
            Includes {formatCurrency(fee)} instant withdrawal fee
          </Text>
        )}
        <Button
          title={isWithdrawing ? 'Processing...' : 'Withdraw Funds'}
          onPress={handleWithdraw}
          loading={isWithdrawing}
          disabled={!amount || isWithdrawing || amountInCents > availableBalance}
          fullWidth
          size="large"
          variant="primary"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  balanceCard: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  presetsContainer: {
    marginTop: 16,
  },
  presetsLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetButton: {
    flex: 1,
    minWidth: 70,
  },
  withdrawTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 12,
  },
  selectedOption: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  optionLeft: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#666666',
  },
  optionRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  feeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  timeframeText: {
    fontSize: 12,
    color: '#666666',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#007AFF',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 12,
  },
  centerContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 20,
  },
  methodsList: {
    gap: 1,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#E65100',
    lineHeight: 18,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
  },
  feeNote: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
});
