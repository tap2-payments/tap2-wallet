/**
 * PIN Verify Screen
 * PIN verification for payments and sensitive actions
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@/stores/authStore';

const THEME_COLOR = '#007AFF';

interface PINVerifyScreenProps extends NativeStackScreenProps<any, 'PINVerify'> {}

interface RouteParams {
  action?: 'payment' | 'transfer' | 'settings' | 'general';
  amount?: number;
  onSuccess?: string; // Route to navigate on success
  onCancelled?: string; // Route to navigate on cancel
}

export const PINVerifyScreen: React.FC<PINVerifyScreenProps> = ({ navigation, route }) => {
  const params = route.params as RouteParams;
  const action = params?.action || 'general';
  const amount = params?.amount;
  const onSuccessRoute = params?.onSuccess;
  const onCancelledRoute = params?.onCancelled;

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(3);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  const { verifyPIN } = useAuthStore();
  const inputRef = useRef<TextInput>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle lock timer
  useEffect(() => {
    if (lockTimer > 0) {
      const timer = setTimeout(() => setLockTimer(lockTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (isLocked && lockTimer === 0) {
      setIsLocked(false);
      setAttempts(3);
    }
  }, [lockTimer, isLocked]);

  const getActionText = (): string => {
    switch (action) {
      case 'payment':
        return amount ? `Confirm payment of $${amount.toFixed(2)}` : 'Confirm payment';
      case 'transfer':
        return 'Confirm transfer';
      case 'settings':
        return 'Access settings';
      default:
        return 'Confirm your identity';
    }
  };

  const handlePINChange = async (value: string) => {
    if (isLocked) return;

    const digits = value.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    setError('');

    if (digits.length === 6) {
      await handleVerifyPIN(digits);
    }
  };

  const handleVerifyPIN = async (pinValue: string) => {
    try {
      const success = await verifyPIN({ pin: pinValue });

      if (success) {
        // Navigate to success route or go back
        if (onSuccessRoute) {
          navigation.replace(onSuccessRoute, params);
        } else {
          navigation.goBack();
        }
      } else {
        handleFailedAttempt();
      }
    } catch {
      handleFailedAttempt();
    }
  };

  const handleFailedAttempt = () => {
    const newAttempts = attempts - 1;
    setAttempts(newAttempts);
    setPin('');

    if (newAttempts <= 0) {
      setIsLocked(true);
      setLockTimer(30); // 30 seconds lockout
      setError('Too many failed attempts. Please try again later.');
    } else {
      setError(
        `Incorrect PIN. ${newAttempts} ${newAttempts === 1 ? 'attempt' : 'attempts'} remaining.`
      );
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0 && !isLocked) {
      setPin(pin.slice(0, -1));
      setError('');
    }
  };

  const handleCancel = () => {
    if (onCancelledRoute) {
      navigation.replace(onCancelledRoute);
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>
          <Text style={styles.title}>Enter PIN</Text>
          <Text style={styles.subtitle}>{getActionText()}</Text>
        </View>

        {/* PIN Dots */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index < pin.length && styles.dotFilled,
                error && styles.dotError,
              ]}
            >
              {index < pin.length && <View style={styles.dotFill} />}
            </View>
          ))}
        </View>

        {/* Error Message */}
        {error ? (
          <View style={[styles.errorContainer, isLocked && styles.errorContainerLocked]}>
            <Text style={styles.errorText}>{error}</Text>
            {isLocked && (
              <Text style={styles.timerText}>Try again in {lockTimer}s</Text>
            )}
          </View>
        ) : null}

        {/* Attempts Remaining */}
        {!error && attempts < 3 && (
          <Text style={styles.attemptsText}>
            {attempts} {attempts === 1 ? 'attempt' : 'attempts'} remaining
          </Text>
        )}

        {/* Cancel Button */}
        {!isLocked && (
          <TouchableOpacity onPress={handleCancel} style={styles.cancelContainer}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {/* Hidden Input */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={pin}
          onChangeText={handlePINChange}
          keyboardType="numeric"
          secureTextEntry
          maxLength={6}
          autoFocus
          editable={!isLocked}
        />

        {/* Biometric Option */}
        {!isLocked && pin.length === 0 && (
          <TouchableOpacity style={styles.biometricContainer}>
            <Text style={styles.biometricText}>Use Face ID instead</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Custom Number Pad */}
      {!isLocked && (
        <NumberPad
          onPress={(value) => {
            if (value === 'backspace') {
              handleBackspace();
            } else if (pin.length < 6) {
              handlePINChange(pin + value);
            }
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
};

// Number Pad Component
interface NumberPadProps {
  onPress: (value: string) => void;
}

const NumberPad: React.FC<NumberPadProps> = ({ onPress }) => {
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
  dotError: {
    borderColor: '#FF3B30',
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
    alignItems: 'center',
  },
  errorContainerLocked: {
    backgroundColor: '#FFF3E0',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  timerText: {
    color: '#F57C00',
    fontSize: 12,
    fontWeight: '600',
  },
  attemptsText: {
    fontSize: 14,
    color: '#FF9800',
    textAlign: 'center',
    marginBottom: 20,
  },
  cancelContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  cancelText: {
    fontSize: 16,
    color: THEME_COLOR,
    fontWeight: '600',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
    width: 0,
  },
  biometricContainer: {
    alignItems: 'center',
    marginTop: 30,
    padding: 12,
  },
  biometricText: {
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
