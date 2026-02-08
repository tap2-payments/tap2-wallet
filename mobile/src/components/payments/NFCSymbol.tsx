/**
 * NFC Symbol Component
 * Animated NFC icon for tap-to-pay screen
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Svg, Path, Circle } from 'react-native-svg';

export interface NFCSymbolProps {
  size?: number;
  isListening?: boolean;
  color?: string;
}

export const NFCSymbol: React.FC<NFCSymbolProps> = ({
  size = 120,
  isListening = false,
  color = '#007AFF',
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isListening) {
      // Start pulsing animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Start subtle rotation
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();

      // Start subtle scale pulse
      const scaleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      scaleAnimation.start();

      return () => {
        pulseAnimation.stop();
        rotateAnimation.stop();
        scaleAnimation.stop();
        pulseAnim.setValue(1);
        rotateAnim.setValue(0);
        scaleAnim.setValue(1);
      };
    }
  }, [isListening, pulseAnim, rotateAnim, scaleAnim]);

  const rippleRadius = size * 0.7;
  const iconSize = size * 0.5;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Ripple effect circles */}
      {isListening && (
        <>
          <Animated.View
            style={[
              styles.ripple,
              {
                width: rippleRadius * 2,
                height: rippleRadius * 2,
                borderRadius: rippleRadius,
                borderColor: color,
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [0.6, 0],
                }),
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ripple,
              {
                width: rippleRadius * 1.5,
                height: rippleRadius * 1.5,
                borderRadius: rippleRadius * 0.75,
                borderColor: color,
                opacity: pulseAnim.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [0.4, 0],
                }),
                transform: [
                  {
                    scale: pulseAnim.interpolate({
                      inputRange: [1, 1.3],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          />
        </>
      )}

      {/* NFC Icon */}
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [
              { scale: scaleAnim },
              {
                rotate: rotateAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '360deg'],
                }),
              },
            ],
          },
        ]}
      >
        <Svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
        >
          {/* Outer curved lines representing wireless/NFC signal */}
          <Path
            d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.3"
          />

          {/* NFC "N" letter */}
          <Path
            d="M7 17V7L12 13L17 7V17"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Signal waves */}
          <Path
            d="M4.5 12C4.5 7.86 7.86 4.5 12 4.5"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M19.5 12C19.5 16.14 16.14 19.5 12 19.5"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Center dot */}
          <Circle
            cx="12"
            cy="12"
            r="2"
            fill={color}
          />
        </Svg>
      </Animated.View>

      {/* Inner glow */}
      {isListening && (
        <Animated.View
          style={[
            styles.glow,
            {
              width: iconSize * 0.6,
              height: iconSize * 0.6,
              borderRadius: iconSize * 0.3,
              backgroundColor: color,
              opacity: pulseAnim.interpolate({
                inputRange: [1, 1.3],
                outputRange: [0.2, 0.4],
              }),
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ripple: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    blurRadius: 20,
  },
});
