import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
  icon,
  iconPosition = 'left',
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      overflow: 'hidden',
    };

    // Size styles
    const sizeStyles: Record<typeof size, ViewStyle> = {
      small: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 36,
      },
      medium: {
        paddingHorizontal: 24,
        paddingVertical: 14,
        minHeight: 48,
      },
      large: {
        paddingHorizontal: 32,
        paddingVertical: 18,
        minHeight: 56,
      },
    };

    // Variant styles
    const variantStyles: Record<typeof variant, ViewStyle> = {
      primary: {
        backgroundColor: disabled ? '#A0A0A0' : '#007AFF',
      },
      secondary: {
        backgroundColor: disabled ? '#E0E0E0' : '#34C759',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: disabled ? '#E0E0E0' : '#007AFF',
      },
      ghost: {
        backgroundColor: 'transparent',
      },
      danger: {
        backgroundColor: disabled ? '#E0E0E0' : '#FF3B30',
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth && { width: '100%' }),
      ...style,
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: '600',
    };

    const sizeStyles: Record<typeof size, TextStyle> = {
      small: { fontSize: 14 },
      medium: { fontSize: 16 },
      large: { fontSize: 18 },
    };

    const variantStyles: Record<typeof variant, TextStyle> = {
      primary: { color: '#FFFFFF' },
      secondary: { color: '#FFFFFF' },
      outline: { color: disabled ? '#A0A0A0' : '#007AFF' },
      ghost: { color: disabled ? '#A0A0A0' : '#007AFF' },
      danger: { color: '#FFFFFF' },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...textStyle,
    };
  };

  return (
    <Pressable
      style={({ pressed }) => [
        getButtonStyle(),
        pressed && !disabled && { opacity: 0.8 },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'outline' || variant === 'ghost' ? '#007AFF' : '#FFFFFF'
          }
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <>{icon}</>
          )}
          <Text style={getTextStyle()}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <>{icon}</>
          )}
        </>
      )}
    </Pressable>
  );
};
