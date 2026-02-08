import { useState, useCallback, useRef } from 'react';
import { useRewardsStore } from '@/stores';

interface UseRewardsPaymentOptions {
  autoShowNotification?: boolean;
  notificationDuration?: number;
  onPointsEarned?: (points: number) => void;
}

interface UseRewardsPaymentReturn {
  showPointsNotification: boolean;
  pointsEarned: number;
  refreshAfterPayment: (transactionId: string) => Promise<void>;
  dismissNotification: () => void;
  getEstimatedPoints: (amount: number) => number;
}

/**
 * Hook for integrating rewards with payment flow
 *
 * Usage:
 * 1. After successful payment, call refreshAfterPayment(transactionId)
 * 2. The hook will fetch points earned and show notification
 * 3. Use getEstimatedPoints to show estimated points before payment
 *
 * @example
 * const { showPointsNotification, pointsEarned, refreshAfterPayment } = useRewardsPayment();
 *
 * // After payment success
 * await refreshAfterPayment(transactionId);
 */
export const useRewardsPayment = (options: UseRewardsPaymentOptions = {}): UseRewardsPaymentReturn => {
  const {
    autoShowNotification = true,
    notificationDuration = 3000,
    onPointsEarned,
  } = options;

  const { refreshAfterPayment: storeRefreshAfterPayment } = useRewardsStore();

  const [showPointsNotification, setShowPointsNotification] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);
  const notificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dismissNotification = useCallback(() => {
    setShowPointsNotification(false);
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
  }, []);

  const refreshAfterPayment = useCallback(
    async (transactionId: string) => {
      try {
        await storeRefreshAfterPayment(transactionId);

        // Note: In production, the actual points earned would come from the API response
        // For now, we'll use a placeholder calculation
        // TODO: Update this when the API returns points earned
        const estimatedPoints = 0; // This should come from the API

        if (estimatedPoints > 0 && autoShowNotification) {
          setPointsEarned(estimatedPoints);
          setShowPointsNotification(true);
          onPointsEarned?.(estimatedPoints);

          notificationTimeoutRef.current = setTimeout(() => {
            dismissNotification();
          }, notificationDuration);
        }
      } catch (error) {
        console.error('Failed to refresh rewards after payment:', error);
      }
    },
    [storeRefreshAfterPayment, autoShowNotification, notificationDuration, onPointsEarned, dismissNotification]
  );

  const getEstimatedPoints = useCallback(
    (amount: number): number => {
      // 1 point per dollar (amount is in cents)
      return Math.floor(amount / 100);
    },
    []
  );

  return {
    showPointsNotification,
    pointsEarned,
    refreshAfterPayment,
    dismissNotification,
    getEstimatedPoints,
  };
};
