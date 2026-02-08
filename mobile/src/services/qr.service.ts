/**
 * QR Service
 * Handles QR code scanning and generation for payments
 *
 * Reference: docs/PLANS-tap-to-pay.md
 */

import { Camera } from 'react-native-vision-camera';
import type {
  QRPaymentData,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface QRInitializationResult {
  success: boolean;
  hasPermission: boolean;
  isCameraAvailable: boolean;
  error?: string;
}

export interface QRParseResult {
  success: boolean;
  data?: QRPaymentData;
  error?: string;
}

export interface QRGenerateOptions {
  userId: string;
  amount?: number;
  currency?: string;
  expiresAt?: Date;
}

// ============================================================================
// QR Service
// ============================================================================

class QRService {
  private isInitialized = false;

  /**
   * Initialize QR scanner (request camera permissions)
   */
  async initialize(): Promise<QRInitializationResult> {
    try {
      // Check if camera is available
      const devices = await Camera.getAvailableCameraDevices();
      const isCameraAvailable = devices.length > 0;

      if (!isCameraAvailable) {
        return {
          success: false,
          hasPermission: false,
          isCameraAvailable: false,
          error: 'No camera available on this device',
        };
      }

      // Request camera permission
      const permission = await Camera.requestCameraPermission();

      this.isInitialized = true;

      return {
        success: permission === 'granted',
        hasPermission: permission === 'granted',
        isCameraAvailable: true,
        error: permission !== 'granted' ? 'Camera permission denied' : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        hasPermission: false,
        isCameraAvailable: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Check camera permission status
   */
  async getCameraPermissionStatus(): Promise<'granted' | 'not-determined' | 'denied'> {
    return await Camera.getCameraPermissionStatus();
  }

  /**
   * Check if camera is available
   */
  async isCameraAvailable(): Promise<boolean> {
    try {
      const devices = await Camera.getAvailableCameraDevices();
      return devices.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Parse QR code data string
   * Expected format: tap2://pay?merchantId=xxx&merchantName=yyy&sessionId=zzz&ts=aaa&amount=bbb
   */
  parseQRCode(qrString: string): QRParseResult {
    try {
      // Check if it's a Tap2 payment URL
      if (!qrString.startsWith('tap2://pay') && !qrString.startsWith('https://tap2.app/pay')) {
        return {
          success: false,
          error: 'Not a Tap2 payment QR code',
        };
      }

      // Parse URL
      let url: URL;

      try {
        // For tap2:// URLs, replace with https:// for URL parsing
        const parseableUrl = qrString.replace('tap2://', 'https://');
        url = new URL(parseableUrl);
      } catch {
        return {
          success: false,
          error: 'Invalid QR code format',
        };
      }

      // Extract parameters
      const merchantId = url.searchParams.get('merchantId');
      const merchantName = url.searchParams.get('merchantName') || url.searchParams.get('n') || 'Merchant';
      const sessionId = url.searchParams.get('sessionId') || url.searchParams.get('sid');
      const timestamp = parseInt(url.searchParams.get('ts') || url.searchParams.get('timestamp') || `${Date.now()}`, 10);
      const amountParam = url.searchParams.get('amount') || url.searchParams.get('amt');

      // Validate required fields
      if (!merchantId) {
        return {
          success: false,
          error: 'Missing merchant ID in QR code',
        };
      }

      if (!sessionId) {
        return {
          success: false,
          error: 'Missing session ID in QR code',
        };
      }

      // Parse amount if provided
      let amount: number | undefined;
      if (amountParam) {
        amount = parseInt(amountParam, 10);
        if (isNaN(amount) || amount < 0) {
          return {
            success: false,
            error: 'Invalid amount in QR code',
          };
        }
      }

      const data: QRPaymentData = {
        merchantId,
        merchantName: decodeURIComponent(merchantName),
        sessionId,
        timestamp: isNaN(timestamp) ? Date.now() : timestamp,
        amount,
      };

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse QR code',
      };
    }
  }

  /**
   * Validate QR data timestamp
   * Returns true if timestamp is within valid range (not expired)
   */
  isValidTimestamp(timestamp: number, maxAgeMinutes = 30): boolean {
    const now = Date.now();
    const ageMs = now - timestamp;
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return ageMs >= 0 && ageMs <= maxAgeMs;
  }

  /**
   * Generate payment payload for API call
   */
  generatePaymentPayload(
    qrData: QRPaymentData,
    amount?: number,
    paymentMethodId?: string
  ): {
    merchantId: string;
    sessionId: string;
    amount: number;
    currency: string;
    paymentMethodId?: string;
    type: 'qr';
  } {
    return {
      merchantId: qrData.merchantId,
      sessionId: qrData.sessionId,
      amount: amount || qrData.amount || 0,
      currency: 'USD',
      paymentMethodId,
      type: 'qr',
    };
  }

  /**
   * Generate QR code URL for receiving payments
   */
  generateReceiveURL(options: QRGenerateOptions): string {
    const { userId, amount, currency = 'USD', expiresAt } = options;

    const params = new URLSearchParams({
      userId,
      currency,
      ts: `${Date.now()}`,
    });

    if (amount !== undefined) {
      params.append('amt', `${amount}`);
    }

    if (expiresAt) {
      params.append('exp', `${expiresAt.getTime()}`);
    }

    return `tap2://receive?${params.toString()}`;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.isInitialized = false;
  }
}

// Export singleton instance
export default new QRService();
