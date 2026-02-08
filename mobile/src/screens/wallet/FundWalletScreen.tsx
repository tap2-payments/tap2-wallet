import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '@/stores';
import { Button, Input, PaymentMethodCard } from '@/components';
import type { RootStackParamList } from '@/navigation';
import type { PaymentMethod } from '@/components/wallet';

interface FundWalletScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FundWallet'>;
  route: RouteProp<RootStackParamList, 'FundWallet'>;
}

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000]; // in cents: $10, $25, $50, $100

export const FundWalletScreen: React.FC<FundWalletScreenProps> = ({
  navigation,
}) => {
  const {
    fundingMethods,
    defaultFundingMethodId,
    isLoadingFundingMethods,
    isFunding,
    fetchFundingMethods,
    fundWallet,
  } = useWalletStore();

  const [amount, setAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(
    null
  );
  const [amountError, setAmountError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);

  useEffect(() => {
    loadFundingMethods();
  }, []);

  useEffect(() => {
    if (defaultFundingMethodId && !selectedMethodId) {
      setSelectedMethodId(defaultFundingMethodId);
    }
  }, [defaultFundingMethodId, selectedMethodId]);

  const loadFundingMethods = async () => {
    try {
      await fetchFundingMethods();
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to load payment methods. Please try again.'
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
    // Remove any non-digit characters except decimal point
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

  const validateInputs = (): boolean => {
    let isValid = true;

    const amountInCents = parseAmount(amount);

    if (amountInCents < 100) {
      setAmountError('Minimum amount is $1.00');
      isValid = false;
    } else if (amountInCents > 1000000) {
      setAmountError('Maximum amount is $10,000');
      isValid = false;
    }

    if (!selectedMethodId) {
      setMethodError('Please select a payment method');
      isValid = false;
    } else {
      setMethodError(null);
    }

    return isValid;
  };

  const handleFund = async () => {
    if (!validateInputs()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const amountInCents = parseAmount(amount);

      await fundWallet({
        amount: amountInCents,
        paymentMethodId: selectedMethodId!,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Success',
        `Successfully added ${formatCurrency(amountInCents)} to your wallet`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Funding Failed',
        error instanceof Error ? error.message : 'Please try again'
      );
    }
  };

  const handleAddPaymentMethod = () => {
    navigation.navigate('AddPaymentMethod');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Amount Input Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enter Amount</Text>

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

        {/* Payment Method Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <Button
              title="+ Add New"
              variant="ghost"
              size="small"
              onPress={handleAddPaymentMethod}
            />
          </View>

          {methodError && (
            <Text style={styles.errorText}>{methodError}</Text>
          )}

          {isLoadingFundingMethods ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : fundingMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>💳</Text>
              <Text style={styles.emptyStateTitle}>No payment methods</Text>
              <Text style={styles.emptyStateDescription}>
                Add a card or bank account to fund your wallet
              </Text>
              <Button
                title="Add Payment Method"
                onPress={handleAddPaymentMethod}
              />
            </View>
          ) : (
            <View style={styles.methodsList}>
              {fundingMethods.map((method) => (
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
            Funds are added instantly. Your bank statement will show this as a
            charge from Tap2 Wallet.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total</Text>
          <Text style={styles.summaryAmount}>
            {amount ? `$${amount}` : '$0.00'}
          </Text>
        </View>
        <Button
          title={isFunding ? 'Processing...' : 'Add Money'}
          onPress={handleFund}
          loading={isFunding}
          disabled={!amount || isFunding}
          fullWidth
          size="large"
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
    backgroundColor: '#E8F5E9',
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
    color: '#2E7D32',
    lineHeight: 18,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 16,
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
});
