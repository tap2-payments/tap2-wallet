/**
 * P2PTapScreen
 * Tap phones together to discover recipient via NFC
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

import { useP2PStore } from '@/stores/p2pStore';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'Transfer'>;

interface NDEFRecord {
  id: string;
  payload: string;
  type: string;
}

export const P2PTapScreen: React.FC<Props> = ({ navigation }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredUser, setDiscoveredUser] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulseAnimation] = useState(new Animated.Value(1));

  const { selectRecipient } = useP2PStore();

  useEffect(() => {
    // Check NFC availability
    checkNFCAvailability();

    return () => {
      // Clean up NFC session
      if (isScanning) {
        NfcManager.cancelTechnologyRequest().catch(() => {});
      }
    };
  }, []);

  const checkNFCAvailability = async () => {
    try {
      const isSupported = await NfcManager.isSupported();

      if (!isSupported) {
        setError('NFC is not available on this device');
        return;
      }

      // Start scanning automatically
      startScanning();
    } catch (err) {
      setError('Could not access NFC');
      console.error('NFC check error:', err);
    }
  };

  const startScanning = async () => {
    setError(null);
    setIsScanning(true);
    startPulseAnimation();

    try {
      await NfcManager.start();

      // Register listener for NDEF tags
      const listener = NfcManager.addListener((data: any) => {
        handleNFCDiscovery(data);
      });

      // Request technology
      await NfcManager.requestTechnology(NfcTech.Ndef);

      // Get the tag
      const tag = await NfcManager.getTag();
      if (tag) {
        handleNFCDiscovery(tag);
      }

      return () => {
        listener.remove();
      };
    } catch (err) {
      console.error('NFC scan error:', err);
      setError('Could not start NFC scanning. Try again.');
      setIsScanning(false);
      stopPulseAnimation();
    }
  };

  const handleNFCDiscovery = async (data: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // Parse NDEF records
      const ndefRecords: NDEFRecord[] = data?.ndefMessage || [];

      for (const record of ndefRecords) {
        // Decode the payload
        const payload = Ndef.text.decodePayload(
          new Uint8Array(record.payload.split('').map((c) => c.charCodeAt(0)))
        );

        try {
          // Try to parse as JSON (Tap2 user data)
          const userData = JSON.parse(payload);

          if (userData.userId && userData.name) {
            setDiscoveredUser(userData);
            setIsScanning(false);
            stopPulseAnimation();

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return;
          }
        } catch {
          // Not JSON, might be plain text
          continue;
        }
      }

      // If we found a tag but couldn't parse Tap2 data
      setError('Found a tag, but it doesn\'t appear to be a Tap2 user');
    } catch (err) {
      setError('Could not read NFC tag');
    }

    setIsScanning(false);
    stopPulseAnimation();
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnimation.stopAnimation();
    pulseAnimation.setValue(1);
  };

  const handleConnect = () => {
    if (discoveredUser) {
      selectRecipient({
        id: discoveredUser.userId,
        name: discoveredUser.name,
        isTap2User: true,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.goBack();
    }
  };

  const handleRetry = () => {
    setDiscoveredUser(null);
    setError(null);
    startScanning();
  };

  const handleCancel = () => {
    if (isScanning) {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={handleCancel}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        {!discoveredUser ? (
          // Scanning State
          <>
            <Animated.View
              style={[
                styles.nfcCircle,
                {
                  transform: [{ scale: pulseAnimation }],
                },
              ]}
            >
              <View style={styles.nfcCircleInner}>
                {isScanning ? (
                  <>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.scanningText}>Hold near device</Text>
                  </>
                ) : (
                  <Text style={styles.nfcIcon}>NFC</Text>
                )}
              </View>
            </Animated.View>

            <Text style={styles.title}>Tap to Connect</Text>
            <Text style={styles.subtitle}>
              Ask the other person to open Tap2 Wallet and tap your phones together
            </Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorIcon}>⚠️</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          // Discovered User State
          <>
            <View style={styles.discoveredAvatar}>
              <Text style={styles.discoveredAvatarText}>
                {discoveredUser.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <Text style={styles.discoveredTitle}>Found Tap2 User!</Text>
            <Text style={styles.discoveredName}>{discoveredUser.name}</Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.connectButton]}
                onPress={handleConnect}
              >
                <Text style={styles.connectButtonText}>Send Money</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.rescanButton]}
                onPress={handleRetry}
              >
                <Text style={styles.rescanButtonText}>Scan Again</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Instructions */}
      {!discoveredUser && (
        <View style={styles.instructions}>
          <Text style={styles.instructionStep}>1. Both open Tap2 Wallet</Text>
          <Text style={styles.instructionStep}>2. Both tap "Tap to Pay"</Text>
          <Text style={styles.instructionStep}>3. Bring phones close together</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  cancelButton: {
    alignSelf: 'flex-start',
    padding: 16,
    paddingTop: 20,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  nfcCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E8F4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  nfcCircleInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  nfcIcon: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
  },
  scanningText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666666',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  discoveredAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  discoveredAvatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discoveredTitle: {
    fontSize: 18,
    color: '#666666',
    marginBottom: 4,
  },
  discoveredName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 32,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#007AFF',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rescanButton: {
    backgroundColor: '#F5F5F5',
  },
  rescanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  instructions: {
    padding: 24,
    backgroundColor: '#F5F5F5',
  },
  instructionStep: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
});
