/**
 * PIN Setup Screen
 * 6-digit PIN setup for secure transactions
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';

const THEME_COLOR = '#007AFF';

interface PINSetupScreenProps extends NativeStackScreenProps<any, 'PINSetup'> {}

type Step = 'create' | 'confirm';

export const PINSetupScreen: React.FC<PINSetupScreenProps> = ({ navigation }) => {
  const [step, setStep] = useState<Step>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [showDots, setShowDots] = useState(false);

  const { setupPIN, isLoading } = useAuthStore();
  const inputRef = useRef<TextInput>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const handlePINChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);

    if (step === 'create') {
      setPin(digits);
      setError('');

      if (digits.length === 6) {
        // Move to confirm step
        setTimeout(() => {
          setStep('confirm');
          setConfirmPin('');
        }, 300);
      }
    } else {
      setConfirmPin(digits);
      setError('');

      if (digits.length === 6) {
        // Verify and setup PIN
        setTimeout(() => {
          handleSetupPIN(digits);
        }, 300);
      }
    }
  };

  const handleSetupPIN = async (confirmValue: string) => {
    if (confirmValue !== pin) {
      setError('PINs do not match. Please try again.');
      setStep('create');
      setPin('');
      setConfirmPin('');
      return;
    }

    try {
      await setupPIN(confirmValue);

      // Navigate to biometric setup
      navigation.replace('BiometricPrompt', { firstTimeSetup: true });
    } catch (err: any) {
      setError(err.message || 'Failed to setup PIN. Please try again.');
      setPin('');
      setConfirmPin('');
      setStep('create');
    }
  };

  const handleBackspace = () => {
    if (step === 'create' && pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError('');
    } else if (step === 'confirm' && confirmPin.length > 0) {
      setConfirmPin(confirmPin.slice(0, -1));
      setError('');
    }
  };

  const currentPIN = step === 'create' ? pin : confirmPin;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔒</Text>
          </View>
          <Text style={styles.title}>
            {step === 'create' ? 'Create PIN' : 'Confirm PIN'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'create'
              ? 'Create a 6-digit PIN for secure transactions'
              : 'Re-enter your PIN to confirm'}
          </Text>
        </View>

        {/* PIN Dots */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index < currentPIN.length && styles.dotFilled,
                index === currentPIN.length && showDots && styles.dotPulse,
              ]}
            >
              {index < currentPIN.length && <View style={styles.dotFill} />}
            </View>
          ))}
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Progress Indicator */}
        {step === 'confirm' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
            <Text style={styles.progressText}>Step 1 of 2</Text>
          </View>
        )}

        {/* PIN Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Why do I need a PIN?</Text>
          <Text style={styles.infoText}>
            Your PIN adds an extra layer of security for payments and sensitive actions.
          </Text>
          <Text style={styles.infoText}>• Required for all payments</Text>
          <Text style={styles.infoText}>• Quick and secure access</Text>
          <Text style={styles.infoText}>• Not shared with anyone</Text>
        </View>

        {/* Hidden Input */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={currentPIN}
          onChangeText={handlePINChange}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          autoFocus
        />

        {/* Skip for now (optional) */}
        {step === 'create' && (
          <TouchableOpacity
            style={styles.skipContainer}
            onPress={() => {
              // Skip and go to main app
              navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              });
            }}
          >
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Custom Number Pad */}
      <NumberPad
        onPress={(value) => {
          if (value === 'backspace') {
            handleBackspace();
          } else if (currentPIN.length < 6) {
            handlePINChange(currentPIN + value);
          }
        }}
        disabled={isLoading}
      />
    </KeyboardAvoidingView>
  );
};

// Number Pad Component
interface NumberPadProps {
  onPress: (value: string) => void;
  disabled?: boolean;
}

const NumberPad: React.FC<NumberPadProps> = ({ onPress, disabled }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

  return (
    <View style={numberPadStyles.container}>
      {keys.map((key, index) => {
        if (key === '') {
          return <View key={index} style={numberPadStyles.keySpacer} />;
        }

        if (key === 'backspace') {
          return (
            <TouchableOpacity
              key={index}
              style={numberPadStyles.key}
              onPress={() => onPress('backspace')}
              disabled={disabled}
            >
              <Text style={numberPadStyles.keyIcon}>⌫</Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={index}
            style={numberPadStyles.key}
            onPress={() => onPress(key)}
            disabled={disabled}
          >
            <Text style={numberPadStyles.keyText}>{key}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${THEME_COLOR}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
    marginHorizontal: 8,
  },
  dotFilled: {
    borderColor: THEME_COLOR,
    backgroundColor: '#F8F8F8',
  },
  dotPulse: {
    borderColor: THEME_COLOR,
  },
  dotFill: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME_COLOR,
    alignSelf: 'center',
    marginTop: 2,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    width: '50%',
    height: '100%',
    backgroundColor: THEME_COLOR,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
  },
  infoContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  skipContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  skipText: {
    fontSize: 14,
    color: THEME_COLOR,
    fontWeight: '500',
  },
});

const numberPadStyles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  key: {
    width: '30%',
    aspectRatio: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginHorizontal: '1.6%',
  },
  keySpacer: {
    width: '30%',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
  },
  keyIcon: {
    fontSize: 24,
    color: '#333333',
  },
});
