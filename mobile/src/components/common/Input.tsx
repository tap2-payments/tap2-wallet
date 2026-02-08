import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  NativeSyntheticEvent,
  TextInputSubmitEditingEventData,
  Pressable,
} from 'react-native';

export interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'numeric'
    | 'phone-pad'
    | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  editable?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  onSubmitEditing?: (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  maxLength?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  editable = true,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  onSubmitEditing,
  returnKeyType = 'done',
  maxLength,
  style,
  inputStyle,
  multiline = false,
  numberOfLines = 1,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(!secureTextEntry);

  const toggleSecureVisibility = () => {
    setIsSecureVisible(!isSecureVisible);
  };

  const renderRightIcon = () => {
    if (secureTextEntry) {
      return (
        <Pressable
          onPress={toggleSecureVisibility}
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.secureTextIcon}>
            {isSecureVisible ? '👁' : '👁‍🗨'}
          </Text>
        </Pressable>
      );
    }

    if (rightIcon && onRightIconPress) {
      return (
        <Pressable
          onPress={onRightIconPress}
          style={styles.iconButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {rightIcon}
        </Pressable>
      );
    }

    if (rightIcon) {
      return <View style={styles.iconContainer}>{rightIcon}</View>;
    }

    return null;
  };

  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={[styles.label, !editable && styles.disabledText]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focusedContainer,
          error && styles.errorContainer,
          !editable && styles.disabledContainer,
        ]}
      >
        {leftIcon && <View style={styles.iconContainer}>{leftIcon}</View>}
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || secureTextEntry) && styles.inputWithRightIcon,
            error && styles.errorInput,
            multiline && styles.multilineInput,
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999999"
          secureTextEntry={secureTextEntry && !isSecureVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
        {renderRightIcon()}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {helperText && !error && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  disabledText: {
    color: '#999999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    height: 52,
  },
  focusedContainer: {
    borderColor: '#007AFF',
  },
  errorContainer: {
    borderColor: '#FF3B30',
  },
  disabledContainer: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  inputWithLeftIcon: {
    marginLeft: 8,
  },
  inputWithRightIcon: {
    marginRight: 8,
  },
  errorInput: {
    color: '#FF3B30',
  },
  multilineInput: {
    height: 'auto',
    minHeight: 100,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  iconContainer: {
    marginRight: 8,
  },
  iconButton: {
    padding: 4,
  },
  secureTextIcon: {
    fontSize: 18,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 6,
  },
  helperText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 6,
  },
});
