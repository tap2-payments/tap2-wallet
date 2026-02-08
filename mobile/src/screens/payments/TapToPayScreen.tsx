/**
 * Tap to Pay Screen
 * NFC payment screen with listening state and QR fallback
 *
 * Reference: docs/PLANS-tap-to-pay.md
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  NativeModules,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useNavigation as useExpoNavigation } from '@react-navigation/native';

import nfcService from '@/services/nfc.service';
import { NFCSymbol, Button } from '@/components';
import type { NFCPaymentData, MainStackParamList } from '@/types';

type NavigationProp = typeof useExpoNavigation;

interface TapToPayRouteParams {
  autoStart?: boolean;
}

export const TapToPayScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<{ TapToPay: TapToPayRouteParams }, 'TapToPay'>>();
  const { autoStart = true } = route.params || {};

  const [isListening, setIsListening] = useState(false);
  const [nfcAvailable, setNfcAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Initialize NFC on mount
  useEffect(() => {
    const initNFC = async () => {
      setInitializing(true);
      setError(null);

      const result = await nfcService.initialize();
      setNfcAvailable(result.isSupported);
      setInitializing(false);

      if (!result.isSupported) {
        setError('NFC is not supported on this device');
        return;
      }

      if (!result.isEnabled) {
        setError('NFC is disabled. Please enable it in settings.');
        return;
      }

      // Auto-start listening if requested
      if (autoStart && result.success) {
        startListening();
      }
    };

    initNFC();

    // Cleanup on unmount
    return () => {
      stopListening();
    };
  }, [autoStart]);

  // Start NFC listening
  const startListening = useCallback(async () => {
    if (isListening) return;

    setError(null);
    setIsListening(true);

    // Haptic feedback to indicate listening started
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await nfcService.listenForPayment({
      timeout: 60000, // 1 minute timeout
      onTagDetected: (data: NFCPaymentData) => {
        handleTagDetected(data);
      },
      onError: (err) => {
        handleError(err);
      },
    });
  }, [isListening]);

  // Stop NFC listening
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    setIsListening(false);
    await nfcService.stopListening();
  }, [isListening]);

  // Handle NFC tag detection
  const handleTagDetected = useCallback((data: NFCPaymentData) => {
    // Strong haptic feedback on tag detection
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Navigate to confirmation screen
    navigation.navigate('PaymentConfirmation' as any, {
      merchantData: data,
      type: 'nfc',
    });
  }, [navigation]);

  // Handle errors
  const handleError = useCallback((err: Error) => {
    setIsListening(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    if (err.message.includes('timeout')) {
      setError('Listening timeout. Please try again.');
    } else if (err.message.includes('cancelled')) {
      setError(null);
    } else {
      setError(err.message);
    }
  }, []);

  // Navigate to QR scanner
  const navigateToQR = useCallback(() => {
    stopListening();
    navigation.navigate('QRPayment' as any);
  }, [navigation, stopListening]);

  // Go back
  const goBack = useCallback(() => {
    stopListening();
    navigation.goBack();
  }, [navigation, stopListening]);

  // Toggle listening state
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  if (initializing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.statusText}>Initializing NFC...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>Cancel</Text>
        </Pressable>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <Text style={styles.title}>
          {isListening ? 'Hold Near Merchant' : 'Tap to Pay'}
        </Text>
        <Text style={styles.subtitle}>
          {isListening
            ? 'Hold your phone near the merchant\'s device'
            : 'Tap the button below to start listening for NFC payments'}
        </Text>

        {/* NFC Symbol */}
        <View style={styles.symbolContainer}>
          <NFCSymbol size={180} isListening={isListening} />
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* NFC unavailable message */}
        {nfcAvailable === false && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              NFC is not available on this device
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          {nfcAvailable === false ? (
            <Button
              title="Use QR Code Instead"
              onPress={navigateToQR}
              variant="primary"
              size="large"
              fullWidth
            />
          ) : (
            <>
              <Button
                title={isListening ? 'Stop Listening' : 'Start Listening'}
                onPress={toggleListening}
                variant={isListening ? 'outline' : 'primary'}
                size="large"
                fullWidth
                style={styles.mainButton}
              />
              <Button
                title="Scan QR Code Instead"
                onPress={navigateToQR}
                variant="ghost"
                size="medium"
                fullWidth
              />
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFF',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  symbolContainer: {
    marginVertical: 40,
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  mainButton: {
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
});
