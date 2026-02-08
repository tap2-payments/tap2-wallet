import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRewardsStore } from '@/stores';
import { Button, LoadingSpinner } from '@/components';
import type { RootStackParamList } from '@/navigation';
import type { RewardOffer } from '@/services/rewards.api';

const { width, height } = Dimensions.get('window');

interface RedeemRewardsScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RedeemRewards'>;
  route: RouteProp<RootStackParamList, 'RedeemRewards'>;
}

// Confetti component
interface ConfettiPiece {
  id: string;
  x: number;
  y: number;
  color: string;
  rotation: number;
  speed: number;
}

const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A855F7', '#3B82F6', '#34C759'];

const ConfettiAnimation: React.FC<{ visible: boolean; onComplete: () => void }> = ({
  visible,
  onComplete,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (visible) {
      // Generate confetti pieces
      const newPieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
        id: `confetti-${i}`,
        x: Math.random() * width,
        y: -20 - Math.random() * 100,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        speed: 5 + Math.random() * 10,
      }));
      setPieces(newPieces);

      // Animate in
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Animate pieces falling and fade out
      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          delay: 2000,
          useNativeDriver: true,
        }).start(() => {
          onComplete();
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.confettiContainer, { opacity }]} pointerEvents="none">
      {pieces.map((piece) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.confettiPiece,
            {
              left: piece.x,
              backgroundColor: piece.color,
              transform: [{ rotate: `${piece.rotation}deg` }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
};

export const RedeemRewardsScreen: React.FC<RedeemRewardsScreenProps> = ({
  navigation,
}) => {
  const {
    points,
    offers,
    isLoadingOffers,
    isRedeeming,
    redeemError,
    recentRedemption,
    fetchOffers,
    redeemPoints,
    clearRecentRedemption,
    clearErrors,
  } = useRewardsStore();

  const [selectedOffer, setSelectedOffer] = useState<RewardOffer | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState(0);

  useEffect(() => {
    loadOffers();
  }, []);

  useEffect(() => {
    if (recentRedemption) {
      setShowSuccessModal(true);
    }
  }, [recentRedemption]);

  const loadOffers = async () => {
    try {
      await fetchOffers();
    } catch (error) {
      console.error('Failed to load offers:', error);
    }
  };

  const handleOfferPress = (offer: RewardOffer) => {
    setSelectedOffer(offer);
    setSelectedPoints(offer.pointsRequired);
    setShowConfirmModal(true);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedOffer) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setShowConfirmModal(false);
    try {
      await redeemPoints({
        offerId: selectedOffer.id,
        points: selectedPoints,
      });
    } catch (error) {
      Alert.alert(
        'Redemption Failed',
        error instanceof Error ? error.message : 'Failed to redeem points. Please try again.'
      );
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    clearRecentRedemption();
    navigation.goBack();
  };

  const handleCopyCode = () => {
    if (recentRedemption?.discountCode) {
      // In a real app, you'd copy to clipboard here
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Code Copied', 'Discount code copied to clipboard!');
    }
  };

  const formatPoints = (value: number): string => {
    return value.toLocaleString();
  };

  const formatDiscount = (offer: RewardOffer): string => {
    if (offer.discountType === 'percentage' && offer.percentage) {
      return `${offer.percentage}%`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(offer.discountValue / 100);
  };

  const groupedOffers = offers.reduce<Record<string, RewardOffer[]>>((acc, offer) => {
    const category = offer.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(offer);
    return acc;
  }, {});

  const categoryOrder: (string | undefined)[] = ['food', 'shopping', 'entertainment', 'travel', 'other'];
  const categoryLabels: Record<string, string> = {
    food: 'Food & Dining',
    shopping: 'Shopping',
    entertainment: 'Entertainment',
    travel: 'Travel',
    other: 'Other Rewards',
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Points balance */}
        <LinearGradient
          colors={['#FFD700', '#FFA500', '#FF8C00']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceHeader}
        >
          <Text style={styles.balanceLabel}>Your Points</Text>
          <Text style={styles.balanceValue}>{formatPoints(points)}</Text>
          <Text style={styles.balanceHint}>
            {formatPoints(points)} points = ${((points / 100).toFixed(2))} value
          </Text>
        </LinearGradient>

        {/* Available offers */}
        <View style={styles.offersSection}>
          <Text style={styles.sectionTitle}>Available Rewards</Text>

          {isLoadingOffers ? (
            <View style={styles.centerContent}>
              <Text style={styles.loadingText}>Loading offers...</Text>
            </View>
          ) : offers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🎁</Text>
              <Text style={styles.emptyStateTitle}>No offers available</Text>
              <Text style={styles.emptyStateDescription}>
                Check back soon for new rewards!
              </Text>
            </View>
          ) : (
            categoryOrder.map((category) => {
              const categoryOffers = groupedOffers[category || 'other'];
              if (!categoryOffers || categoryOffers.length === 0) return null;

              return (
                <View key={category || 'other'} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>
                    {categoryLabels[category || 'other']}
                  </Text>
                  {categoryOffers.map((offer) => {
                    const canRedeem = points >= offer.pointsRequired && offer.isAvailable;
                    return (
                      <TouchableOpacity
                        key={offer.id}
                        style={[
                          styles.offerCard,
                          !canRedeem && styles.offerCardDisabled,
                        ]}
                        onPress={() => canRedeem && handleOfferPress(offer)}
                        disabled={!canRedeem}
                      >
                        <View style={styles.offerContent}>
                          <View style={styles.offerIconContainer}>
                            <Text style={styles.offerIcon}>🎁</Text>
                          </View>
                          <View style={styles.offerDetails}>
                            <Text style={styles.offerTitle}>{offer.title}</Text>
                            <Text style={styles.offerDescription} numberOfLines={1}>
                              {offer.description}
                            </Text>
                          </View>
                          <View style={styles.offerPricing}>
                            <Text style={styles.offerDiscount}>
                              {formatDiscount(offer)}
                            </Text>
                            <Text style={styles.offerPoints}>
                              {formatPoints(offer.pointsRequired)} pts
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Redeem Points?</Text>

            {selectedOffer && (
              <>
                <View style={styles.confirmOfferCard}>
                  <Text style={styles.confirmOfferTitle}>{selectedOffer.title}</Text>
                  <Text style={styles.confirmOfferDescription}>
                    {selectedOffer.description}
                  </Text>
                  <View style={styles.confirmDiscount}>
                    <Text style={styles.confirmDiscountText}>
                      {formatDiscount(selectedOffer)} discount
                    </Text>
                  </View>
                </View>

                <View style={styles.confirmPointsRow}>
                  <Text style={styles.confirmPointsLabel}>Points Required:</Text>
                  <Text style={styles.confirmPointsValue}>
                    {formatPoints(selectedOffer.pointsRequired)}
                  </Text>
                </View>

                <View style={styles.confirmBalanceRow}>
                  <Text style={styles.confirmBalanceLabel}>Your Balance:</Text>
                  <Text style={styles.confirmBalanceValue}>
                    {formatPoints(points)}
                  </Text>
                </View>

                <View style={styles.confirmNewBalanceRow}>
                  <Text style={styles.confirmNewBalanceLabel}>Remaining:</Text>
                  <Text style={styles.confirmNewBalanceValue}>
                    {formatPoints(points - selectedOffer.pointsRequired)}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowConfirmModal(false)}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Confirm Redemption"
                onPress={handleConfirmRedeem}
                variant="primary"
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleSuccessClose}
      >
        <ConfettiAnimation
          visible={showSuccessModal}
          onComplete={() => {}}
        />
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <Text style={styles.successIcon}>🎉</Text>
            <Text style={styles.successTitle}>Points Redeemed!</Text>

            {recentRedemption && (
              <>
                <View style={styles.discountCodeContainer}>
                  <Text style={styles.discountCodeLabel}>Your Discount Code</Text>
                  <TouchableOpacity onPress={handleCopyCode}>
                    <View style={styles.discountCodeBox}>
                      <Text style={styles.discountCode}>
                        {recentRedemption.discountCode}
                      </Text>
                      <Text style={styles.copyIcon}>📋</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={styles.successDetails}>
                  <Text style={styles.successDetail}>
                    Value: ${((recentRedemption.discountValue / 100).toFixed(2))}
                  </Text>
                  <Text style={styles.successDetail}>
                    Expires: {new Date(recentRedemption.expiresAt).toLocaleDateString()}
                  </Text>
                </View>

                <Text style={styles.successHint}>
                  Use this code at checkout to apply your discount
                </Text>
              </>
            )}

            <Button
              title="Done"
              onPress={handleSuccessClose}
              variant="primary"
              style={styles.successButton}
            />
          </View>
        </View>
      </Modal>

      {isRedeeming && <LoadingSpinner visible overlay text="Redeeming points..." />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  scrollView: {
    flex: 1,
  },
  balanceHeader: {
    padding: 24,
    paddingTop: 32,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  balanceHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  offersSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 16,
  },
  centerContent: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  offerCardDisabled: {
    opacity: 0.6,
  },
  offerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  offerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  offerIcon: {
    fontSize: 20,
  },
  offerDetails: {
    flex: 1,
  },
  offerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  offerDescription: {
    fontSize: 13,
    color: '#666666',
  },
  offerPricing: {
    alignItems: 'flex-end',
  },
  offerDiscount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B00',
    marginBottom: 2,
  },
  offerPoints: {
    fontSize: 12,
    color: '#999999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmOfferCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  confirmOfferTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  confirmOfferDescription: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 12,
  },
  confirmDiscount: {
    alignSelf: 'flex-start',
  },
  confirmDiscountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF6B00',
  },
  confirmPointsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  confirmPointsLabel: {
    fontSize: 14,
    color: '#666666',
  },
  confirmPointsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  confirmBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  confirmBalanceLabel: {
    fontSize: 14,
    color: '#666666',
  },
  confirmBalanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  confirmNewBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginBottom: 20,
  },
  confirmNewBalanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  confirmNewBalanceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  successModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  successIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 24,
  },
  discountCodeContainer: {
    width: '100%',
    marginBottom: 24,
  },
  discountCodeLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 8,
    textAlign: 'center',
  },
  discountCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderStyle: 'dashed',
  },
  discountCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 2,
    marginRight: 8,
  },
  copyIcon: {
    fontSize: 18,
  },
  successDetails: {
    width: '100%',
    marginBottom: 16,
    gap: 4,
  },
  successDetail: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  successHint: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  successButton: {
    width: '100%',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
