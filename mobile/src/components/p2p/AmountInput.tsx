/**
 * AmountInput Component
 * Custom numeric keypad for entering payment amounts
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  TouchableOpacity,
} from 'react-native';

export interface AmountInputProps {
  value: number;
  onChange: (amount: number) => void;
  currency?: string;
  maxAmount?: number;
  style?: any;
  showKeypad?: boolean;
  onDone?: () => void;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  currency = '$',
  maxAmount,
  style,
  showKeypad = true,
  onDone,
}) => {
  const [inputValue, setInputValue] = useState(formatAmount(value));

  function formatAmount(amount: number): string {
    return (amount / 100).toFixed(2);
  }

  const handleKeyPress = (key: string) => {
    let newValue = inputValue.replace('.', '');

    if (key === 'backspace') {
      newValue = newValue.slice(0, -1);
    } else if (key === 'clear') {
      setInputValue('0.00');
      onChange(0);
      return;
    } else {
      // Digit key
      newValue = newValue + key;
    }

    // Pad to ensure we have at least 3 digits for decimal places
    while (newValue.length < 3) {
      newValue = '0' + newValue;
    }

    // Insert decimal point
    const integerPart = newValue.slice(0, -2) || '0';
    const decimalPart = newValue.slice(-2);
    const formatted = `${integerPart}.${decimalPart}`;

    // Check max amount
    const newAmount = parseInt(formatted.replace('.', ''), 10);
    if (maxAmount && newAmount > maxAmount * 100) {
      return; // Don't update if exceeds max
    }

    setInputValue(formatted);
    onChange(newAmount);
  };

  const handleDone = () => {
    onDone?.();
  };

  return (
    <View style={[styles.container, style]}>
      {/* Amount Display */}
      <View style={styles.displayContainer}>
        <Text style={styles.currencySymbol}>{currency}</Text>
        <Text style={styles.amountDisplay}>{inputValue}</Text>
      </View>

      {/* Quick Amount Buttons */}
      <View style={styles.quickAmountContainer}>
        {['5', '10', '20', '50', '100'].map((amount) => (
          <TouchableOpacity
            key={amount}
            style={styles.quickAmountButton}
            onPress={() => {
              const newAmount = parseInt(amount, 10) * 100;
              setInputValue(formatAmount(newAmount));
              onChange(newAmount);
            }}
          >
            <Text style={styles.quickAmountText}>{currency}{amount}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Keypad */}
      {showKeypad && (
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['clear', '0', 'backspace'],
          ].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.key,
                    key === '0' && styles.zeroKey,
                    key === 'clear' && styles.clearKey,
                    key === 'backspace' && styles.backspaceKey,
                  ]}
                  onPress={() => handleKeyPress(key)}
                >
                  {key === 'backspace' ? (
                    <Text style={styles.keyText}>⌫</Text>
                  ) : (
                    <Text style={[styles.keyText, key.length > 1 && styles.specialKeyText]}>
                      {key === 'clear' ? 'C' : key}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {onDone && (
            <View style={styles.doneRow}>
              <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
  displayContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  currencySymbol: {
    fontSize: 36,
    fontWeight: '600',
    color: '#666666',
    marginRight: 4,
  },
  amountDisplay: {
    fontSize: 48,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 2,
  },
  quickAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  keypad: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 4,
  },
  key: {
    width: 72,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  zeroKey: {
    width: 72,
  },
  clearKey: {
    backgroundColor: '#FFE5E5',
  },
  backspaceKey: {
    backgroundColor: '#E8F4FF',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#333333',
  },
  specialKeyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  doneRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  doneButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 24,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
