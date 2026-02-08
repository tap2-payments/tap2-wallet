/**
 * Login Screen
 * Email/phone login with password
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

interface LoginScreenProps extends NativeStackScreenProps<any, 'Login'> {}

type LoginMethod = 'email' | 'phone';

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  const { login, isLoading, error, clearError } = useAuthStore();

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!identifier.trim()) {
      newErrors.identifier = loginMethod === 'email' ? 'Email is required' : 'Phone number is required';
    } else if (loginMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      newErrors.identifier = 'Invalid email address';
    } else if (loginMethod === 'phone' && !/^\+?[\d\s-]{10,}$/.test(identifier)) {
      newErrors.identifier = 'Invalid phone number';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    clearError();

    if (!validate()) {
      return;
    }

    try {
      await login({ identifier, password });
      // Navigation will be handled by auth flow
    } catch {
      // Error is handled by the store
    }
  };

  const toggleLoginMethod = () => {
    setLoginMethod(prev => prev === 'email' ? 'phone' : 'email');
    setIdentifier('');
    setErrors({});
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
        {/* Logo/Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>💳</Text>
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to your Tap2 Wallet</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <Input
            label={loginMethod === 'email' ? 'Email Address' : 'Phone Number'}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={loginMethod === 'email' ? 'you@example.com' : '+1 (555) 000-0000'}
            keyboardType={loginMethod === 'email' ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.identifier}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.password}
            onSubmitEditing={handleLogin}
            returnKeyType="done"
          />

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Forgot Password Link */}
          <TouchableOpacity style={styles.forgotPasswordContainer}>
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isLoading}
            fullWidth
            size="large"
          />

          {/* Toggle Login Method */}
          <TouchableOpacity onPress={toggleLoginMethod} style={styles.toggleContainer}>
            <Text style={styles.toggleText}>
              {loginMethod === 'email'
                ? 'Sign in with phone number instead'
                : 'Sign in with email instead'}
            </Text>
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Sign Up</Text>
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
    marginTop: 40,
    marginBottom: 40,
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: THEME_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  toggleText: {
    color: THEME_COLOR,
    fontSize: 14,
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#666666',
    fontSize: 14,
  },
  registerLink: {
    color: THEME_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
});
