import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export interface BiometricResult {
  success: boolean;
  error?: string;
}

/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and fingerprint authentication
 */
class BiometricService {
  private compatible = false;
  private enrolled = false;

  /**
   * Initialize and check biometric support
   */
  async initialize(): Promise<void> {
    try {
      this.compatible = await LocalAuthentication.hasHardwareAsync();
      this.enrolled = await LocalAuthentication.isEnrolledAsync();
    } catch (error) {
      console.error('Failed to initialize biometric service:', error);
      this.compatible = false;
      this.enrolled = false;
    }
  }

  /**
   * Check if biometric authentication is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.compatible) {
      await this.initialize();
    }
    return this.compatible && this.enrolled;
  }

  /**
   * Get the type of biometric authentication available
   */
  async getBiometricType(): Promise<'facial' | 'fingerprint' | 'none'> {
    if (!(await this.isAvailable())) {
      return 'none';
    }

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'facial';
    }

    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'fingerprint';
    }

    return 'none';
  }

  /**
   * Authenticate with biometrics
   */
  async authenticate(promptMessage: string = 'Authenticate to continue'): Promise<BiometricResult> {
    try {
      const available = await this.isAvailable();

      if (!available) {
        return {
          success: false,
          error: 'Biometric authentication is not available',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error || 'Authentication failed',
      };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Check if biometric authentication is enabled
   */
  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Enable biometric authentication
   */
  async enable(): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  }

  /**
   * Disable biometric authentication
   */
  async disable(): Promise<void> {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  }
}

export const biometricService = new BiometricService();
