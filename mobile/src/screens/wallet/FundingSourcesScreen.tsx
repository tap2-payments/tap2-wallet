import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useWalletStore } from '@/stores';
import { PaymentMethodCard } from '@/components';
import type { RootStackParamList } from '@/navigation';
import type { PaymentMethod } from '@/components/wallet';

interface FundingSourcesScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'FundingSources'>;
  route: RouteProp<RootStackParamList, 'FundingSources'>;
}

export const FundingSourcesScreen: React.FC<FundingSourcesScreenProps> = ({
  navigation,
}) => {
  const {
    fundingMethods,
    defaultFundingMethodId,
    isLoadingFundingMethods,
    isAddingPaymentMethod,
    fetchFundingMethods,
    deletePaymentMethod,
    setDefaultPaymentMethod,
    addPaymentMethod,
  } = useWalletStore();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Text
          style={styles.addButton}
          onPress={() => navigation.navigate('AddPaymentMethod')}
        >
          + Add
        </Text>
      ),
    });
  }, [navigation]);

  const loadFundingMethods = async () => {
    try {
      await fetchFundingMethods();
    } catch (error) {
      console.error('Failed to load payment methods:', error);
    }
  };

  useEffect(() => {
    loadFundingMethods();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadFundingMethods();
    } finally {
      setRefreshing(false);
    }
  };

  const handleMethodPress = useCallback(
    (method: PaymentMethod) => {
      // Show options for the payment method
      const options = [
        'Set as Default',
        'Remove Payment Method',
        'Cancel',
      ];

      const isDefault = method.id === defaultFundingMethodId;

      Alert.alert(
        method.brand || method.bankName || 'Payment Method',
        isDefault ? 'This is your default payment method' : 'Choose an action',
        isDefault
          ? [
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => handleDeleteMethod(method.id),
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          : [
              {
                text: 'Set as Default',
                onPress: () => handleSetDefault(method.id),
              },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => handleDeleteMethod(method.id),
              },
              { text: 'Cancel', style: 'cancel' },
            ]
      );
    },
    [defaultFundingMethodId]
  );

  const handleSetDefault = async (methodId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await setDefaultPaymentMethod(methodId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Payment method set as default');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to set default'
      );
    }
  };

  const handleDeleteMethod = async (methodId: string) => {
    // Confirm deletion
    Alert.alert(
      'Remove Payment Method',
      'Are you sure you want to remove this payment method? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            try {
              await deletePaymentMethod(methodId);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              Alert.alert('Removed', 'Payment method removed successfully');
            } catch (error) {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Error
              );
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to remove payment method'
              );
            }
          },
        },
      ]
    );
  };

  const handleAddNew = () => {
    navigation.navigate('AddPaymentMethod');
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>💳</Text>
      <Text style={styles.emptyStateTitle}>No payment methods</Text>
      <Text style={styles.emptyStateDescription}>
        Add a card or bank account to fund your wallet
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (fundingMethods.length === 0) return null;

    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Tap a payment method to manage it or set it as default
        </Text>
      </View>
    );
  };

  const renderMethodItem = ({ item }: { item: PaymentMethod }) => (
    <PaymentMethodCard
      method={item}
      selected={item.id === defaultFundingMethodId}
      onPress={() => handleMethodPress(item)}
      showDefaultBadge={true}
    />
  );

  return (
    <View style={styles.container}>
      {isLoadingFundingMethods && fundingMethods.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={fundingMethods}
          keyExtractor={(item) => item.id}
          renderItem={renderMethodItem}
          contentContainerStyle={
            fundingMethods.length === 0 ? styles.listContentEmpty : styles.listContent
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 16,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
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
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
  },
});
