import * as Haptics from 'expo-haptics';
import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';

export function HomeScreen() {
  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Tap Detected', 'Tap-to-Pay feature coming soon!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Tap2 Wallet</Text>
      <Text style={styles.subtitle}>Your digital wallet for tap-to-pay payments</Text>
      <Pressable style={styles.tapButton} onPress={handleTap}>
        <Text style={styles.buttonText}>Tap to Pay</Text>
      </Pressable>
      <Text style={styles.balance}>Balance: $0.00</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  tapButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 12,
    marginBottom: 30,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  balance: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
});
