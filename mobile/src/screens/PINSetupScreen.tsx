import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface PINSetupScreenProps {
  onSuccess?: (pin: string) => void;
}

export function PINSetupScreen({ onSuccess }: PINSetupScreenProps): React.JSX.Element {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [showPin, setShowPin] = useState(false);

  const handlePinSubmit = () => {
    if (pin.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }

    // Check for weak PINs
    const weakPINs = ['0000', '1111', '1234', '4321', '2222', '3333', '4444'];
    if (weakPINs.includes(pin)) {
      Alert.alert('Weak PIN', 'Please choose a stronger PIN');
      return;
    }

    if (step === 'create') {
      setStep('confirm');
    } else {
      if (pin === confirmPin) {
        onSuccess?.(pin);
      } else {
        Alert.alert('PIN Mismatch', 'The PINs do not match. Please try again.');
        setStep('create');
        setPin('');
        setConfirmPin('');
      }
    }
  };

  const handlePinChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 4);

    if (step === 'create') {
      setPin(numericValue);
    } else {
      setConfirmPin(numericValue);
    }

    // Auto-submit when 4 digits entered
    if (numericValue.length === 4) {
      if (step === 'create') {
        setTimeout(() => setStep('confirm'), 100);
      } else {
        setTimeout(handlePinSubmit, 100);
      }
    }
  };

  const currentPin = step === 'create' ? pin : confirmPin;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{step === 'create' ? 'Create a PIN' : 'Confirm Your PIN'}</Text>

        <Text style={styles.description}>
          {step === 'create'
            ? 'Create a 4-digit PIN to secure your payments. You will need this for transactions.'
            : 'Enter your PIN again to confirm it.'}
        </Text>

        <Pressable onPress={() => setShowPin(!showPin)} style={styles.pinToggle}>
          <Text style={styles.pinToggleText}>{showPin ? 'Hide' : 'Show'} PIN</Text>
        </Pressable>

        <View style={styles.pinContainer}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[styles.pinDot, (index < currentPin.length || showPin) && styles.pinDotFilled]}
            >
              {(index < currentPin.length || showPin) && (
                <Text style={styles.pinDigit}>{showPin ? currentPin[index] : '•'}</Text>
              )}
            </View>
          ))}
        </View>

        <TextInput
          style={styles.hiddenInput}
          value={currentPin}
          onChangeText={handlePinChange}
          keyboardType="number-pad"
          secureTextEntry={!showPin}
          maxLength={4}
          autoFocus
          onSubmitEditing={handlePinSubmit}
        />

        <View style={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Pressable
              key={num}
              style={styles.keypadButton}
              onPress={() => handlePinChange(currentPin + num.toString())}
            >
              <Text style={styles.keypadButtonText}>{num}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.keypadButton}>
            <Text style={styles.keypadButtonText} />
          </Pressable>
          <Pressable
            style={styles.keypadButton}
            onPress={() => handlePinChange(currentPin.slice(0, -1))}
          >
            <Text style={styles.keypadButtonText}>⌫</Text>
          </Pressable>
          <Pressable style={styles.keypadButton} onPress={() => handlePinChange(currentPin + '0')}>
            <Text style={styles.keypadButtonText}>0</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  pinToggle: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  pinToggleText: {
    color: '#007AFF',
    fontSize: 14,
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 48,
  },
  pinDot: {
    width: 48,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  pinDotFilled: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pinDigit: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  keypadButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButtonText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1a1a1a',
  },
});
