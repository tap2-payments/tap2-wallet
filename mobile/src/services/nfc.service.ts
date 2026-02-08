/**
 * NFC Service
 * Handles NFC tag detection and payment data parsing
 *
 * Reference: docs/PLANS-tap-to-pay.md
 */

import NfcManager, {
  Ndef,
  NdefRecord,
  TagEvent,
} from 'react-native-nfc-manager';
import * as Haptics from 'expo-haptics';
import type {
  MerchantNDEFPayload,
  NFCPaymentData,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface NFCListenOptions {
  timeout?: number; // Auto-stop after ms (default: 30000)
  onTagDetected?: (data: NFCPaymentData) => void;
  onError?: (error: Error) => void;
}

export interface NFCInitializationResult {
  success: boolean;
  isEnabled: boolean;
  isSupported: boolean;
  error?: string;
}

// ============================================================================
// NFC Service
// ============================================================================

class NFCService {
  private isInitialized = false;
  private isListening = false;
  private timeoutId: NodeJS.Timeout | null = null;

  /**
   * Initialize NFC module
   */
  async initialize(): Promise<NFCInitializationResult> {
    try {
      await NfcManager.start();

      const isEnabled = await NfcManager.isEnabled();
      this.isInitialized = true;

      return {
        success: true,
        isEnabled,
        isSupported: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if device doesn't support NFC
      if (errorMessage.includes('not supported') || errorMessage.includes('Feature')) {
        return {
          success: false,
          isEnabled: false,
          isSupported: false,
          error: 'NFC is not supported on this device',
        };
      }

      return {
        success: false,
        isEnabled: false,
        isSupported: true,
        error: errorMessage,
      };
    }
  }

  /**
   * Check if NFC is available and enabled
   */
  async isNFCAvailable(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      return await NfcManager.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Start listening for NFC tags
   */
  async listenForPayment(options: NFCListenOptions = {}): Promise<void> {
    const { timeout = 30000, onTagDetected, onError } = options;

    if (this.isListening) {
      await this.stopListening();
    }

    try {
      this.isListening = true;

      // Request NFC NDEF technology
      await NfcManager.requestTechnology(NfcManager.Ndef);

      // Register tag listener
      const tagListener = NfcManager.addListener(
        TagEvent,
        (tag: TagEvent) => {
          this.handleTagDetected(tag, onTagDetected, onError);
        }
      );

      // Set timeout to auto-stop listening
      if (timeout > 0) {
        this.timeoutId = setTimeout(() => {
          this.stopListening();
          onError?.(new Error('NFC listening timeout'));
        }, timeout);
      }

      // Clean up listener when stopped
      return new Promise((resolve) => {
        resolve();
      });
    } catch (error) {
      this.isListening = false;
      onError?.(error instanceof Error ? error : new Error('NFC listen failed'));
    }
  }

  /**
   * Handle NFC tag detection
   */
  private async handleTagDetected(
    tag: TagEvent,
    onTagDetected?: (data: NFCPaymentData) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Provide haptic feedback on tag detection
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Parse NDEF message from tag
      const paymentData = this.parseNdefMessage(tag);

      if (!paymentData) {
        onError?.(new Error('Invalid payment tag format'));
        return;
      }

      // Stop listening after successful detection
      await this.stopListening();

      // Notify callback
      onTagDetected?.(paymentData);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to process tag'));
    }
  }

  /**
   * Parse NDEF message from NFC tag
   */
  private parseNdefMessage(tag: TagEvent): NFCPaymentData | null {
    try {
      const ndefMessage = tag.ndefMessage;

      if (!ndefMessage || ndefMessage.length === 0) {
        return null;
      }

      // Find the first NDEF record
      const record = ndefMessage[0];

      // Parse the payload
      const payloadBytes = record.payload;
      const payloadString = this.bytesToString(payloadBytes);

      // Try to parse as JSON
      let payload: MerchantNDEFPayload;
      try {
        // Handle TNF WELL_KNOWN with JSON type
        // First byte might be type length, skip it
        let jsonString = payloadString;

        // Check if payload starts with type length indicator
        if (payloadBytes.length > 0 && payloadBytes[0] < payloadString.length) {
          const typeLength = payloadBytes[0];
          jsonString = payloadString.slice(typeLength);
        }

        payload = JSON.parse(jsonString) as MerchantNDEFPayload;
      } catch {
        // Try parsing the full string
        payload = JSON.parse(payloadString) as MerchantNDEFPayload;
      }

      // Validate payload structure
      if (!this.isValidMerchantPayload(payload)) {
        return null;
      }

      // Convert to NFCPaymentData format
      return {
        merchantId: payload.m,
        merchantName: payload.n,
        amount: payload.amt,
        currency: payload.cur || 'USD',
        nonce: payload.nonce,
        timestamp: payload.ts || Date.now(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Validate merchant NDEF payload
   */
  private isValidMerchantPayload(payload: Partial<MerchantNDEFPayload>): boolean {
    return !!(
      payload.m &&
      payload.n &&
      typeof payload.amt === 'number' &&
      payload.nonce
    );
  }

  /**
   * Convert byte array to string
   */
  private bytesToString(bytes: number[]): string {
    return bytes
      .map((byte) => String.fromCharCode(byte))
      .join('');
  }

  /**
   * Stop listening for NFC tags
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {
      // Ignore errors when canceling
    }

    this.isListening = false;
  }

  /**
   * Generate payment payload for API call
   */
  generatePaymentPayload(
    paymentData: NFCPaymentData,
    paymentMethodId?: string
  ): {
    merchantId: string;
    amount: number;
    currency: string;
    nonce: string;
    paymentMethodId?: string;
    type: 'nfc';
  } {
    return {
      merchantId: paymentData.merchantId,
      amount: paymentData.amount,
      currency: paymentData.currency,
      nonce: paymentData.nonce,
      paymentMethodId,
      type: 'nfc',
    };
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    await this.stopListening();
    this.isInitialized = false;
  }
}

// Export singleton instance
export default new NFCService();
