/**
 * Verify Email Screen
 * Email verification code input
 */

import React, { useState, useEffect, useRef } from 'react';
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

const THEME_COLOR = '#007AFF';

interface VerifyEmailScreenProps extends NativeStackScreenProps<any, 'VerifyEmail'> {}

export const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({
  navigation,
  route,
}) => {
  const email = route.params?.email || '';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Initialize input refs
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
  }, []);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const focusInput = (index: number) => {
    setFocusedIndex(index);
    inputRefs.current[index]?.focus();
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (digit && index < 5) {
      focusInput(index + 1);
    }

    // Auto-submit when all digits entered
    if (digit && index === 5 && newCode.every((c) => c !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    // Handle backspace - move to previous input
    if (key === 'Backspace' && !code[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handleVerify = async (verificationCode?: string) => {
    const codeToVerify = verificationCode || code.join('');

    if (codeToVerify.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // TODO: Call API to verify email
      // await authApi.verifyEmail({ email, code: codeToVerify });

      // For now, simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Navigate to next screen (PIN setup)
      navigation.reset({
        index: 0,
        routes: [{ name: 'PINSetup' }],
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setError('');

    try {
      // TODO: Call API to resend verification code
      // await authApi.resendEmailVerification({ email });

      // For now, simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reset timer
      setResendTimer(30);
      setCanResend(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = (pastedText: string) => {
    const digits = pastedText.replace(/\D/g, '').slice(0, 6);
    const newCode = ['', '', '', '', '', ''];

    for (let i = 0; i < digits.length; i++) {
      newCode[i] = digits[i];
    }

    setCode(newCode);

    if (digits.length === 6) {
      handleVerify(digits);
    } else if (digits.length > 0) {
      focusInput(digits.length);
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
            <Text style={styles.icon}>✉️</Text>
          </View>
          <Text style={styles.title}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to{' '}
            <Text style={styles.emailText}>{email || 'your email'}</Text>
          </Text>
        </View>

        {/* Code Input */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.codeInput,
                focusedIndex === index && styles.codeInputFocused,
                error && styles.codeInputError,
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(index, text)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(index, key)}
              onFocus={() => setFocusedIndex(index)}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              selectTextOnFocus
              maxLength={1}
            />
          ))}
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Resend Code */}
        <TouchableOpacity
          style={styles.resendContainer}
          onPress={handleResend}
          disabled={!canResend || isLoading}
        >
          <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>
            {canResend
              ? "Didn't receive the code? "
              : `Resend code in ${resendTimer}s`}
          </Text>
          {canResend && <Text style={styles.resendLink}>Resend</Text>}
        </TouchableOpacity>

        {/* Verify Button */}
        <Button
          title="Verify Email"
          onPress={() => handleVerify()}
          loading={isLoading}
          fullWidth
          size="large"
          style={styles.verifyButton}
        />

        {/* Change Email Link */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.changeEmailContainer}
        >
          <Text style={styles.changeEmailText}>Wrong email? Go back</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  },
  emailText: {
    fontWeight: '600',
    color: '#333333',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#F8F8F8',
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
  },
  codeInputFocused: {
    borderColor: THEME_COLOR,
    backgroundColor: '#FFFFFF',
  },
  codeInputError: {
    borderColor: '#FF3B30',
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
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  resendText: {
    fontSize: 14,
    color: '#666666',
  },
  resendTextDisabled: {
    color: '#999999',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLOR,
    marginLeft: 4,
  },
  verifyButton: {
    marginBottom: 16,
  },
  changeEmailContainer: {
    alignItems: 'center',
  },
  changeEmailText: {
    fontSize: 14,
    color: THEME_COLOR,
    fontWeight: '500',
  },
});
