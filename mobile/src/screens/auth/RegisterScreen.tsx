/**
 * Register Screen
 * New user registration
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Input } from '@/components/common';
import { Button } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';

const THEME_COLOR = '#007AFF';

interface RegisterScreenProps extends NativeStackScreenProps<any, 'Register'> {}

interface FormData {
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const { register, isLoading, error, clearError } = useAuthStore();

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s-]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    // Confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Terms
    if (!acceptedTerms) {
      // We'll show this differently
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    clearError();

    if (!validate()) {
      return;
    }

    if (!acceptedTerms) {
      setErrors({ email: 'Please accept the terms and conditions' });
      return;
    }

    try {
      await register({
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });
      // Navigation will be handled by auth flow
    } catch {
      // Error is handled by the store
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>💳</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Start your Tap2 Wallet journey</Text>
        </View>

        {/* Registration Form */}
        <View style={styles.form}>
          <Input
            label="Email Address"
            value={formData.email}
            onChangeText={(text) => updateField('email', text)}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
          />

          <Input
            label="Phone Number"
            value={formData.phone}
            onChangeText={(text) => updateField('phone', text)}
            placeholder="+1 (555) 000-0000"
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.phone}
          />

          <Input
            label="Password"
            value={formData.password}
            onChangeText={(text) => updateField('password', text)}
            placeholder="At least 8 characters"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.password}
          />

          <Input
            label="Confirm Password"
            value={formData.confirmPassword}
            onChangeText={(text) => updateField('confirmPassword', text)}
            placeholder="Re-enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.confirmPassword}
            onSubmitEditing={handleRegister}
            returnKeyType="done"
          />

          {/* Password Requirements */}
          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Password requirements:</Text>
            <Text style={styles.requirementText}>• At least 8 characters</Text>
            <Text style={styles.requirementText}>• Uppercase and lowercase letters</Text>
            <Text style={styles.requirementText}>• At least one number</Text>
          </View>

          {/* Terms and Conditions */}
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsText}>
                I accept the{' '}
                <Text style={styles.termsLink}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </TouchableOpacity>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Register Button */}
          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={isLoading}
            fullWidth
            size="large"
          />

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${THEME_COLOR}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  form: {
    width: '100%',
  },
  requirementsContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: THEME_COLOR,
    borderColor: THEME_COLOR,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  termsLink: {
    color: THEME_COLOR,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: '#666666',
    fontSize: 14,
  },
  loginLink: {
    color: THEME_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
});
