import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '@/stores';
import { Button, Input } from '@/components';
import type { RootStackParamList } from '@/navigation';
import type { PaymentMethodType } from '@/components/wallet';

type AddPaymentMethodType = 'card' | 'bank' | null;

interface AddPaymentMethodScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddPaymentMethod'>;
  route: RouteProp<RootStackParamList, 'AddPaymentMethod'>;
}

interface MethodOption {
  type: PaymentMethodType;
  title: string;
  description: string;
  icon: string;
}

const METHOD_OPTIONS: MethodOption[] = [
  {
    type: 'card',
    title: 'Debit Card',
    description: 'Add a debit card instantly',
    icon: '💳',
  },
  {
    type: 'bank',
    title: 'Bank Account',
    description: 'Link your bank account securely',
    icon: '🏦',
  },
];

export const AddPaymentMethodScreen: React.FC<
  AddPaymentMethodScreenProps
> = ({ navigation, route }) => {
  const { isAddingPaymentMethod, addPaymentMethod } = useWalletStore();

  // Check if a specific type was passed in route params
  const initialType =
    route.params?.type === 'card' || route.params?.type === 'bank'
      ? route.params.type
      : null;

  const [selectedType, setSelectedType] = useState<AddPaymentMethodType>(
    initialType
  );

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);

  // Bank form state
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');

  // Validation errors
  const [cardError, setCardError] = useState<string | null>(null);
  const [expiryError, setExpiryError] = useState<string | null>(null);
  const [cvvError, setCvvError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [bankError, setBankError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [routingError, setRoutingError] = useState<string | null>(null);

  const formatCardNumber = (text: string): string => {
    const cleaned = text.replace(/\s/g, '').replace(/\D/g, '');
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : '';
  };

  const formatExpiryDate = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const handleCardNumberChange = (value: string) => {
    setCardNumber(formatCardNumber(value));
    setCardError(null);
  };

  const handleExpiryDateChange = (value: string) => {
    setExpiryDate(formatExpiryDate(value));
    setExpiryError(null);
  };

  const validateCard = (): boolean => {
    let isValid = true;

    const cleanedCardNumber = cardNumber.replace(/\s/g, '');
    if (cleanedCardNumber.length < 13 || cleanedCardNumber.length > 19) {
      setCardError('Please enter a valid card number');
      isValid = false;
    }

    const expiryMatch = expiryDate.match(/^(\d{2})\/(\d{2})$/);
    if (!expiryMatch) {
      setExpiryError('Please enter a valid expiry date (MM/YY)');
      isValid = false;
    } else {
      const month = parseInt(expiryMatch[1], 10);
      const year = parseInt('20' + expiryMatch[2], 10);
      const now = new Date();
      const expiry = new Date(year, month - 1);

      if (month < 1 || month > 12) {
        setExpiryError('Invalid month');
        isValid = false;
      } else if (expiry < now) {
        setExpiryError('Card has expired');
        isValid = false;
      }
    }

    if (cvv.length < 3) {
      setCvvError('Please enter a valid CVV');
      isValid = false;
    }

    if (cardHolderName.trim().length < 2) {
      setNameError('Please enter the cardholder name');
      isValid = false;
    }

    return isValid;
  };

  const validateBank = (): boolean => {
    let isValid = true;

    if (bankName.trim().length < 2) {
      setBankError('Please enter bank name');
      isValid = false;
    }

    if (accountNumber.replace(/\D/g, '').length < 4) {
      setAccountError('Please enter a valid account number');
      isValid = false;
    }

    if (routingNumber.replace(/\D/g, '').length !== 9) {
      setRoutingError('Please enter a valid 9-digit routing number');
      isValid = false;
    }

    if (accountHolderName.trim().length < 2) {
      setNameError('Please enter account holder name');
      isValid = false;
    }

    return isValid;
  };

  const handleAddCard = async () => {
    if (!validateCard()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // In a real implementation, you would use Stripe.js to tokenize the card
      // For now, we'll simulate the tokenization
      const mockToken = `card_token_${Date.now()}`;

      const expiryParts = expiryDate.split('/');
      const expiryMonth = parseInt(expiryParts[0], 10);
      const expiryYear = parseInt('20' + expiryParts[1], 10);

      await addPaymentMethod({
        type: 'card',
        token: mockToken,
        isDefault: setAsDefault,
        metadata: {
          brand: detectCardBrand(cardNumber),
          last4: cardNumber.slice(-4),
          expiryMonth,
          expiryYear,
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Card added successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add card'
      );
    }
  };

  const handleAddBank = async () => {
    if (!validateBank()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // In a real implementation, you would use Plaid Link to get a public token
      // For now, we'll simulate the process
      const mockToken = `bank_token_${Date.now()}`;

      await addPaymentMethod({
        type: 'bank',
        token: mockToken,
        isDefault: setAsDefault,
        metadata: {
          bankName: bankName.trim(),
          last4: accountNumber.slice(-4),
          accountType: 'checking',
        },
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Bank account added successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add bank account'
      );
    }
  };

  const detectCardBrand = (number: string): string => {
    const patterns: Record<string, RegExp> = {
      visa: /^4/,
      mastercard: /^5[1-5]/,
      amex: /^3[47]/,
      discover: /^6(?:011|5)/,
    };

    for (const [brand, pattern] of Object.entries(patterns)) {
      if (pattern.test(number)) {
        return brand.charAt(0).toUpperCase() + brand.slice(1);
      }
    }

    return 'Card';
  };

  const renderMethodSelection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Choose Payment Method Type</Text>
      {METHOD_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.type}
          style={styles.methodOption}
          onPress={() => {
            setSelectedType(option.type);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Text style={styles.methodIcon}>{option.icon}</Text>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>{option.title}</Text>
            <Text style={styles.methodDescription}>
              {option.description}
            </Text>
          </View>
          <View style={styles.methodArrow}>
            <Text style={styles.arrowIcon}>›</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCardForm = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Card Details</Text>
        <Button
          title="Change"
          variant="ghost"
          size="small"
          onPress={() => {
            setSelectedType(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        />
      </View>

      <Input
        label="Card Number"
        value={cardNumber}
        onChangeText={handleCardNumberChange}
        placeholder="1234 5678 9012 3456"
        keyboardType="number-pad"
        maxLength={19}
        error={cardError}
        leftIcon={<Text style={styles.inputIcon}>💳</Text>}
      />

      <View style={styles.row}>
        <View style={styles.halfWidth}>
          <Input
            label="Expiry Date"
            value={expiryDate}
            onChangeText={handleExpiryDateChange}
            placeholder="MM/YY"
            keyboardType="number-pad"
            maxLength={5}
            error={expiryError}
          />
        </View>
        <View style={styles.halfWidth}>
          <Input
            label="CVV"
            value={cvv}
            onChangeText={(value) => {
              setCvv(value);
              setCvvError(null);
            }}
            placeholder="123"
            keyboardType="number-pad"
            maxLength={4}
            secureTextEntry
            error={cvvError}
          />
        </View>
      </View>

      <Input
        label="Cardholder Name"
        value={cardHolderName}
        onChangeText={(value) => {
          setCardHolderName(value);
          setNameError(null);
        }}
        placeholder="Name on card"
        autoCapitalize="words"
        error={nameError}
      />

      <TouchableOpacity
        style={styles.defaultToggle}
        onPress={() => {
          setSetAsDefault(!setAsDefault);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <View
          style={[
            styles.toggleCheckbox,
            setAsDefault && styles.toggleChecked,
          ]}
        >
          {setAsDefault && <Text style={styles.toggleCheck}>✓</Text>}
        </View>
        <Text style={styles.toggleLabel}>Set as default payment method</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBankForm = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bank Account Details</Text>
        <Button
          title="Change"
          variant="ghost"
          size="small"
          onPress={() => {
            setSelectedType(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        />
      </View>

      <Text style={styles.infoText}>
        For secure bank verification, we use Plaid. Your login credentials are
        never stored.
      </Text>

      <Input
        label="Bank Name"
        value={bankName}
        onChangeText={(value) => {
          setBankName(value);
          setBankError(null);
        }}
        placeholder="e.g., Chase, Bank of America"
        autoCapitalize="words"
        error={bankError}
        leftIcon={<Text style={styles.inputIcon}>🏦</Text>}
      />

      <Input
        label="Account Holder Name"
        value={accountHolderName}
        onChangeText={(value) => {
          setAccountHolderName(value);
          setNameError(null);
        }}
        placeholder="Name on account"
        autoCapitalize="words"
        error={nameError}
      />

      <Input
        label="Account Number"
        value={accountNumber}
        onChangeText={(value) => {
          setAccountNumber(value);
          setAccountError(null);
        }}
        placeholder="Enter account number"
        keyboardType="number-pad"
        secureTextEntry
        error={accountError}
      />

      <Input
        label="Routing Number"
        value={routingNumber}
        onChangeText={(value) => {
          setRoutingNumber(value);
          setRoutingError(null);
        }}
        placeholder="9-digit routing number"
        keyboardType="number-pad"
        maxLength={9}
        error={routingError}
      />

      <TouchableOpacity
        style={styles.defaultToggle}
        onPress={() => {
          setSetAsDefault(!setAsDefault);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <View
          style={[
            styles.toggleCheckbox,
            setAsDefault && styles.toggleChecked,
          ]}
        >
          {setAsDefault && <Text style={styles.toggleCheck}>✓</Text>}
        </View>
        <Text style={styles.toggleLabel}>Set as default payment method</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {!selectedType && renderMethodSelection()}

        {selectedType === 'card' && renderCardForm()}

        {selectedType === 'bank' && renderBankForm()}

        {selectedType && (
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>🔒</Text>
            <Text style={styles.infoText}>
              Your information is encrypted and secure. We never store your
              full card number or bank credentials.
            </Text>
          </View>
        )}
      </ScrollView>

      {selectedType && (
        <View style={styles.footer}>
          <Button
            title={isAddingPaymentMethod ? 'Adding...' : 'Add Payment Method'}
            onPress={selectedType === 'card' ? handleAddCard : handleAddBank}
            loading={isAddingPaymentMethod}
            fullWidth
            size="large"
          />
        </View>
      )}
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
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 12,
  },
  methodIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  methodDescription: {
    fontSize: 14,
    color: '#666666',
  },
  methodArrow: {
    marginLeft: 12,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#999999',
    fontWeight: '300',
  },
  inputIcon: {
    fontSize: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  toggleCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toggleChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  toggleCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 18,
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
  },
});
