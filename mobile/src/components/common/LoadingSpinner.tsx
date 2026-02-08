import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Text,
} from 'react-native';

export interface LoadingSpinnerProps {
  visible?: boolean;
  size?: 'small' | 'large';
  color?: string;
  overlay?: boolean;
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  visible = true,
  size = 'large',
  color = '#007AFF',
  overlay = false,
  text,
}) => {
  const content = (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );

  if (overlay) {
    return (
      <Modal transparent visible={visible} animationType="none">
        <View style={styles.overlay}>
          {content}
        </View>
      </Modal>
    );
  }

  return visible ? content : null;
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
