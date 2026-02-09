import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from 'react-native';

import { biometricService } from '@/services/biometric';

interface PINVerifyScreenProps {
  onBiometricSuccess?: () => void;
  onPINSuccess?: (pin: string) => void;
  biometricEnabled?: boolean;
}

export function PINVerifyScreen({
  onBiometricSuccess,
  onPINSuccess,
  biometricEnabled = true,
}: PINVerifyScreenProps): React.JSX.Element {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  const handleBiometric = async () => {
    const result = await biometricService.authenticate('Authenticate to access Tap2 Wallet');
    if (result.success) {
      onBiometricSuccess?.();
    } else {
      setError(result.error || 'Biometric authentication failed');
    }
  };

  const handlePinChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(numericValue);
    setError(null);

    // Auto-submit when 4 digits entered
    if (numericValue.length === 4) {
      setTimeout(() => {
        onPINSuccess?.(numericValue);
      }, 100);
    }
  };

  const handleBackspace = () => {
    const newPin = pin.slice(0, -1);
    setPin(newPin);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Tap2 Wallet</Text>

        {biometricEnabled && pin.length === 0 && (
          <Pressable style={styles.biometricButton} onPress={handleBiometric}>
            <Text style={styles.biometricIcon}>🔐</Text>
            <Text style={styles.biometricText}>Use Face ID / Touch ID</Text>
          </Pressable>
        )}

        <View style={styles.pinContainer}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                (index < pin.length || showPin) && styles.pinDotFilled,
                error && styles.pinDotError,
              ]}
            >
              {(index < pin.length || showPin) && (
                <Text style={styles.pinDigit}>{showPin ? pin[index] : '•'}</Text>
              )}
            </View>
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable onPress={() => setShowPin(!showPin)} style={styles.pinToggle}>
          <Text style={styles.pinToggleText}>{showPin ? 'Hide' : 'Show'} PIN</Text>
        </Pressable>

        <View style={styles.keypad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Pressable
              key={num}
              style={styles.keypadButton}
              onPress={() => handlePinChange(pin + num.toString())}
            >
              <Text style={styles.keypadButtonText}>{num}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.keypadButton} onPress={handleBiometric}>
            <Text style={styles.keypadButtonText}>🔐</Text>
          </Pressable>
          <Pressable style={styles.keypadButton} onPress={handleBackspace}>
            <Text style={styles.keypadButtonText}>⌫</Text>
          </Pressable>
          <Pressable style={styles.keypadButton} onPress={() => handlePinChange(pin + '0')}>
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
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 48,
  },
  biometricButton: {
    alignItems: 'center',
    marginBottom: 32,
  },
  biometricIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  biometricText: {
    fontSize: 14,
    color: '#666',
  },
  pinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
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
  pinDotError: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFE5E5',
  },
  pinDigit: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  pinToggle: {
    alignSelf: 'center',
    marginBottom: 32,
  },
  pinToggleText: {
    color: '#007AFF',
    fontSize: 14,
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
