import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface ProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  valueLabel?: string;
  height?: number;
  showPercentage?: boolean;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
  animated?: boolean;
  gradientColors?: string[];
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  valueLabel,
  height = 8,
  showPercentage = true,
  color,
  backgroundColor = '#F0F0F0',
  style,
  animated = true,
  gradientColors,
}) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const defaultGradientColors = color
    ? [color, color]
    : ['#FFD700', '#FFA500'];

  const colors = gradientColors || defaultGradientColors;

  return (
    <View style={[styles.container, style]}>
      {(label || valueLabel || showPercentage) && (
        <View style={styles.labelRow}>
          {label && <Text style={styles.label}>{label}</Text>}
          <View style={styles.labelSpacer} />
          {(valueLabel || showPercentage) && (
            <Text style={styles.valueLabel}>
              {valueLabel || `${Math.round(clampedProgress)}%`}
            </Text>
          )}
        </View>
      )}

      <View
        style={[
          styles.track,
          { height, backgroundColor },
        ]}
      >
        <View
          style={[
            styles.fill,
            { width: `${clampedProgress}%` },
          ]}
        >
          <LinearGradient
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  labelSpacer: {
    flex: 1,
  },
  valueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  track: {
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
  },
});
