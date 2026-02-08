import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 48;
const CARD_HEIGHT = 180;

export interface BalanceCardProps {
  balance: number;
  currency?: string;
  onPress?: () => void;
  showEyeButton?: boolean;
  balanceVisible?: boolean;
  onToggleVisibility?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balance,
  currency = 'USD',
  onPress,
  showEyeButton = true,
  balanceVisible = true,
  onToggleVisibility,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatBalance = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount / 100); // Convert from cents
  };

  const maskedBalance = '••••••••';

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Animated.View
        style={[
          styles.cardContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={['#007AFF', '#0055CC', '#003399']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.cardContent}>
            <View style={styles.topRow}>
              <View style={styles.chipContainer}>
                <View style={styles.chip} />
                <View style={styles.chipLines} />
              </View>
              {showEyeButton && onToggleVisibility && (
                <Pressable
                  onPress={onToggleVisibility}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.eyeIcon}>
                    {balanceVisible ? '👁' : '👁‍🗨'}
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.balanceContainer}>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balanceAmount}>
                {balanceVisible ? formatBalance(balance) : maskedBalance}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.cardNumberContainer}>
                <View style={styles.cardNumberDots}>
                  {[...Array(12)].map((_, i) => (
                    <View key={i} style={styles.dot} />
                  ))}
                </View>
              </View>
              <View style={styles.cardBrand}>
                <Text style={styles.brandText}>TAP2</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipContainer: {
    position: 'relative',
    width: 45,
    height: 35,
  },
  chip: {
    position: 'absolute',
    width: 45,
    height: 35,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.6)',
  },
  chipLines: {
    position: 'absolute',
    top: 8,
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.6)',
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 20,
  },
  balanceContainer: {
    alignItems: 'flex-start',
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNumberContainer: {
    flex: 1,
  },
  cardNumberDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 120,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginRight: 6,
    marginBottom: 6,
  },
  cardBrand: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
});
