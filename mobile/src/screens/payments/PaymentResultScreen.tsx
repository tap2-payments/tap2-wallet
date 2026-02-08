/**
 * Payment Result Screen
 * Success/failure result with animation
 *
 * Reference: docs/PLANS-tap-to-pay.md
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components';
import type { PaymentResultData } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const PaymentResultScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const result = (route.params as any) as PaymentResultData;

  const [animScale] = useState(new Animated.Value(0));
  const [animOpacity] = useState(new Animated.Value(0));
  const [confettiAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(animScale, {
        toValue: 1,
        duration: 400,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Trigger confetti for success
    if (result.state === 'success') {
      Animated.loop(
        Animated.timing(confettiAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ).start();
    }

    // Haptic feedback based on result
    if (result.state === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (result.state === 'failed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [result.state, animScale, animOpacity, confettiAnim]);

  // Format amount
  const formatAmount = (): string => {
    if (!result.amount) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(result.amount / 100);
  };

  // Handle done
  const handleDone = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' as any, state: { routes: [{ name: 'WalletHome' as any }] } }],
    });
  }, [navigation]);

  // Handle try again
  const handleTryAgain = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  }, [navigation]);

  // Render icon based on state
  const renderIcon = () => {
    const size = 80;
    const scale = animScale;

    if (result.state === 'success') {
      return (
        <Animated.View style={{ transform: [{ scale }] }}>
          <View style={[styles.iconContainer, styles.successIcon]}>
            <Text style={styles.iconText}>✓</Text>
          </View>
        </Animated.View>
      );
    }

    if (result.state === 'failed') {
      return (
        <Animated.View style={{ transform: [{ scale }] }}>
          <View style={[styles.iconContainer, styles.failedIcon]}>
            <Text style={styles.iconText}>✕</Text>
          </View>
        </Animated.View>
      );
    }

    // Timeout
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[styles.iconContainer, styles.timeoutIcon]}>
          <Text style={styles.iconText}>!</Text>
        </View>
      </Animated.View>
    );
  };

  // Render content based on state
  const renderContent = () => {
    const amount = formatAmount();

    if (result.state === 'success') {
      return (
        <>
          <Animated.Text style={[styles.title, { opacity: animOpacity }]}>
            Payment Successful!
          </Animated.Text>
          <Animated.Text style={[styles.merchantName, { opacity: animOpacity }]}>
            {result.merchantName}
          </Animated.Text>
          {amount && (
            <Animated.Text style={[styles.amount, { opacity: animOpacity }]}>
              {amount}
            </Animated.Text>
          )}
          <Animated.Text style={[styles.message, { opacity: animOpacity }]}>
            Your payment has been completed successfully.
          </Animated.Text>
        </>
      );
    }

    if (result.state === 'failed') {
      return (
        <>
          <Animated.Text style={[styles.title, { opacity: animOpacity }]}>
            Payment Failed
          </Animated.Text>
          <Animated.Text style={[styles.errorMessage, { opacity: animOpacity }]}>
            {result.errorMessage || 'Something went wrong with your payment.'}
          </Animated.Text>
          {amount && (
            <Animated.Text style={[styles.amount, { opacity: animOpacity }]}>
              {amount}
            </Animated.Text>
          )}
          <Animated.Text style={[styles.hint, { opacity: animOpacity }]}>
            Please try again or contact support if the problem persists.
          </Animated.Text>
        </>
      );
    }

    // Timeout
    return (
      <>
        <Animated.Text style={[styles.title, { opacity: animOpacity }]}>
          Payment Pending
        </Animated.Text>
        <Animated.Text style={[styles.message, { opacity: animOpacity }]}>
          {result.errorMessage || 'Your payment is taking longer than expected.'}
        </Animated.Text>
        {amount && (
          <Animated.Text style={[styles.amount, { opacity: animOpacity }]}>
            {amount}
          </Animated.Text>
        )}
        <Animated.Text style={[styles.hint, { opacity: animOpacity }]}>
          Don't worry - if the payment went through, you'll see it in your transaction history.
        </Animated.Text>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {renderIcon()}
        {renderContent()}

        {/* Confetti effect for success */}
        {result.state === 'success' && (
          <Animated.View
            style={[
              styles.confettiContainer,
              {
                opacity: confettiAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 1, 0],
                }),
              },
            ]}
          >
            {[...Array(20)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.confetti,
                  {
                    backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'][i % 5],
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  },
                ]}
              />
            ))}
          </Animated.View>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {result.state === 'success' ? (
          <>
            <Button
              title="Done"
              onPress={handleDone}
              variant="primary"
              size="large"
              fullWidth
            />
            <Button
              title="View Receipt"
              onPress={() => {
                (navigation as any).navigate('TransactionDetails', {
                  transactionId: result.paymentId,
                });
              }}
              variant="outline"
              size="medium"
              fullWidth
            />
          </>
        ) : (
          <>
            <Button
              title="Try Again"
              onPress={handleTryAgain}
              variant="primary"
              size="large"
              fullWidth
            />
            <Button
              title="Done"
              onPress={handleDone}
              variant="ghost"
              size="medium"
              fullWidth
            />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIcon: {
    backgroundColor: '#34C759',
  },
  failedIcon: {
    backgroundColor: '#FF3B30',
  },
  timeoutIcon: {
    backgroundColor: '#FF9500',
  },
  iconText: {
    fontSize: 40,
    color: '#FFF',
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  merchantName: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  amount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginVertical: 16,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  hint: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  buttonContainer: {
    padding: 20,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
