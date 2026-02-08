/**
 * Biometric Prompt Screen
 * Face ID/Touch ID prompt for biometric authentication
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  AppState,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '@/stores/authStore';

const THEME_COLOR = '#007AFF';

interface BiometricPromptScreenProps extends NativeStackScreenProps<any, 'BiometricPrompt'> {}

interface RouteParams {
  firstTimeSetup?: boolean;
  action?: 'login' | 'payment' | 'transfer' | 'settings';
  onSuccess?: string;
  onCancelled?: string;
}

export const BiometricPromptScreen: React.FC<BiometricPromptScreenProps> = ({
  navigation,
  route,
}) => {
  const params = route.params as RouteParams;
  const firstTimeSetup = params?.firstTimeSetup || false;
  const action = params?.action || 'login';
  const onSuccessRoute = params?.onSuccess;
  const onCancelledRoute = params?.onCancelled;

  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { biometricAvailable, enableBiometric, disableBiometric, authenticateWithBiometric } =
    useAuthStore();

  useEffect(() => {
    checkBiometricType();

    if (!firstTimeSetup && biometricAvailable) {
      // Auto-trigger authentication
      setTimeout(() => {
        handleAuthenticate();
      }, 500);
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && !firstTimeSetup && !success && biometricAvailable) {
        handleAuthenticate();
      }
    });

    return () => subscription.remove();
  }, [success, biometricAvailable]);

  const checkBiometricType = async () => {
    try {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('fingerprint');
      }
    } catch {
      setBiometricType('none');
    }
  };

  const getBiometricName = (): string => {
    if (Platform.OS === 'ios') {
      return biometricType === 'face' ? 'Face ID' : 'Touch ID';
    }
    return biometricType === 'face' ? 'Face Unlock' : 'Fingerprint';
  };

  const getBiometricIcon = (): string => {
    return biometricType === 'face' ? '👤' : '👆';
  };

  const getMessage = (): string => {
    if (firstTimeSetup) {
      return `Enable ${getBiometricName()} for quick and secure access to your wallet.`;
    }

    switch (action) {
      case 'payment':
        return 'Authenticate to complete this payment';
      case 'transfer':
        return 'Authenticate to complete this transfer';
      case 'settings':
        return 'Authenticate to access settings';
      default:
        return `Use ${getBiometricName()} to sign in to your wallet`;
    }
  };

  const handleAuthenticate = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    setError('');

    try {
      const result = await authenticateWithBiometric(
        firstTimeSetup ? 'Enable biometric authentication' : 'Authenticate to continue'
      );

      if (result) {
        setSuccess(true);

        if (firstTimeSetup) {
          await enableBiometric();
        }

        // Navigate after short delay
        setTimeout(() => {
          if (onSuccessRoute) {
            navigation.replace(onSuccessRoute, params);
          } else if (firstTimeSetup) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          } else {
            navigation.goBack();
          }
        }, 500);
      } else {
        setError('Authentication was cancelled');
        setIsAuthenticating(false);
      }
    } catch (err: any) {
      if (err.code === 'not_enrolled') {
        setError(`No biometrics enrolled. Please set up ${getBiometricName()} in your device settings.`);
      } else if (err.code === 'lockout') {
        setError('Too many attempts. Please use your PIN instead.');
      } else if (err.code === 'user_cancel') {
        setError('Authentication cancelled');
      } else {
        setError('Authentication failed. Please try again.');
      }
      setIsAuthenticating(false);
    }
  };

  const handleSkip = async () => {
    if (firstTimeSetup) {
      // User skipped biometric setup
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } else {
      handleCancel();
    }
  };

  const handleUsePIN = () => {
    if (firstTimeSetup) {
      // Skip biometric and go to main
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } else {
      // Navigate to PIN verification
      navigation.replace('PINVerify', {
        ...params,
        biometricFallback: true,
      });
    }
  };

  const handleCancel = () => {
    if (onCancelledRoute) {
      navigation.replace(onCancelledRoute);
    } else {
      navigation.goBack();
    }
  };

  const handleRetry = () => {
    setError('');
    handleAuthenticate();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, success && styles.iconContainerSuccess]}>
            <Text style={styles.icon}>{success ? '✓' : getBiometricIcon()}</Text>
          </View>

          <Text style={styles.title}>
            {firstTimeSetup ? `Enable ${getBiometricName()}` : getBiometricName()}
          </Text>

          <Text style={styles.subtitle}>{getMessage()}</Text>
        </View>

        {/* Status Indicator */}
        <View style={styles.statusContainer}>
          {isAuthenticating && (
            <>
              <View style={styles.pulseDot} />
              <Text style={styles.statusText}>Waiting for authentication...</Text>
            </>
          )}

          {success && (
            <>
              <View style={styles.successDot} />
              <Text style={styles.successText}>Authentication successful!</Text>
            </>
          )}

          {error && !success && (
            <>
              <View style={styles.errorDot} />
              <Text style={styles.errorText}>{error}</Text>
            </>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {!isAuthenticating && !success && (
            <>
              {error ? (
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleAuthenticate}
                >
                  <Text style={styles.primaryButtonText}>
                    {firstTimeSetup ? 'Enable' : 'Authenticate'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.secondaryButton} onPress={handleUsePIN}>
                <Text style={styles.secondaryButtonText}>Use PIN Instead</Text>
              </TouchableOpacity>

              {firstTimeSetup && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                  <Text style={styles.skipButtonText}>Skip for Now</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {!firstTimeSetup && !isAuthenticating && !success && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${THEME_COLOR}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  iconContainerSuccess: {
    backgroundColor: '#34C75925',
    borderColor: '#34C759',
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 30,
    lineHeight: 24,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
    minHeight: 60,
  },
  pulseDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: THEME_COLOR,
    marginBottom: 12,
  },
  successDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#34C759',
    marginBottom: 12,
  },
  errorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  actionsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: THEME_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
    minWidth: 200,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
    minWidth: 200,
  },
  secondaryButtonText: {
    color: THEME_COLOR,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginBottom: 12,
    minWidth: 200,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  skipButton: {
    marginTop: 8,
  },
  skipButtonText: {
    color: '#999999',
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#999999',
    fontSize: 14,
  },
});
