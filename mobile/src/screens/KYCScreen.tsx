import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';

type KYCStatus = 'not_started' | 'pending' | 'in_progress' | 'completed' | 'failed';

interface KYCScreenProps {
  onComplete?: () => void;
}

export function KYCScreen({ onComplete }: KYCScreenProps): React.JSX.Element {
  const [status, setStatus] = useState<KYCStatus>('not_started');
  const [loading, setLoading] = useState(false);

  const startKYC = async () => {
    setLoading(true);
    setStatus('in_progress');

    try {
      // TODO: Integrate Persona SDK
      // For now, simulate KYC process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setStatus('completed');
      onComplete?.();
    } catch (error) {
      console.error('KYC failed:', error);
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'not_started':
        return (
          <>
            <Text style={styles.title}>Verify Your Identity</Text>
            <Text style={styles.description}>
              To use Tap2 Wallet, we need to verify your identity. This helps us prevent fraud and
              keep everyone safe.
            </Text>

            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>You'll need:</Text>
              <View style={styles.requirementItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.requirementText}>
                  A valid government-issued ID (passport, driver's license, or ID card)
                </Text>
              </View>
              <View style={styles.requirementItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.requirementText}>A well-lit area for taking photos</Text>
              </View>
              <View style={styles.requirementItem}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.requirementText}>About 5 minutes to complete</Text>
              </View>
            </View>

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={startKYC}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Start Verification</Text>
              )}
            </Pressable>
          </>
        );

      case 'in_progress':
        return (
          <>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.title}>Verification in Progress</Text>
            <Text style={styles.description}>
              This usually takes about 2-3 minutes. Don't close this window.
            </Text>
          </>
        );

      case 'completed':
        return (
          <>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.title}>Verification Complete!</Text>
            <Text style={styles.description}>
              Your identity has been verified. You can now use all Tap2 Wallet features.
            </Text>
            <Pressable style={styles.button} onPress={onComplete}>
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </>
        );

      case 'failed':
        return (
          <>
            <Text style={styles.errorIcon}>✕</Text>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.description}>
              We couldn't verify your identity. Please try again.
            </Text>
            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={startKYC}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Try Again</Text>
              )}
            </Pressable>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>{renderContent()}</View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Verification powered by Persona. Your information is encrypted and secure.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  requirements: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  requirementItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 8,
    fontWeight: '600',
  },
  requirementText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successIcon: {
    fontSize: 64,
    color: '#34C759',
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 64,
    color: '#FF3B30',
    marginBottom: 16,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
