/**
 * RequestDetailsScreen
 * View incoming payment request and accept/decline
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { useP2PStore } from '@/stores/p2pStore';
import { useWalletStore } from '@/stores/walletStore';
import { RequestCard } from '@/components/p2p';
import type { PaymentRequest } from '@/types';
import type { MainStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'TransactionDetails'>;

interface RequestDetailsScreenProps {
  requestId: string;
  type: 'incoming' | 'outgoing';
}

// Using the existing TransactionDetails route for flexibility
export const RequestDetailsScreen: React.FC<
  NativeStackScreenProps<MainStackParamList, 'TransactionDetails'> & RequestDetailsScreenProps
> = ({ route, navigation }) => {
  // Get requestId from route params or use passed prop
  const requestId = (route.params as any)?.requestId || '';
  const requestType = ((route.params as any)?.type as 'incoming' | 'outgoing') || 'incoming';

  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const { incomingRequests, outgoingRequests, isLoadingRequests, acceptRequest, declineRequest } =
    useP2PStore();
  const { balance } = useWalletStore();

  useEffect(() => {
    // Find the request in the store
    const allRequests = requestType === 'incoming' ? incomingRequests : outgoingRequests;
    const found = allRequests.find((r) => r.id === requestId);

    if (found) {
      setRequest(found);
    }
    setIsLoading(false);
  }, [requestId, requestType, incomingRequests, outgoingRequests]);

  const handleAccept = async () => {
    if (!request) return;

    const amountInDollars = request.amount / 100;

    if (amountInDollars > balance) {
      Alert.alert(
        'Insufficient Balance',
        `You need $${(amountInDollars - balance / 100).toFixed(2)} more to accept this request.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Money',
            onPress: () => navigation.navigate('FundWallet' as never),
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Accept Request?',
      `Pay ${request.fromUserName} $${amountInDollars.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay',
          onPress: async () => {
            setIsProcessing(true);
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await acceptRequest(request.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Payment Sent!',
                `You paid ${request.fromUserName} $${amountInDollars.toFixed(2)}`,
                [{ text: 'Done', onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Payment Failed', 'Could not complete the payment. Please try again.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleDecline = async () => {
    if (!request) return;

    Alert.alert('Decline Request?', 'Are you sure you want to decline this payment request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline',
        style: 'destructive',
        onPress: async () => {
          setIsProcessing(true);
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await declineRequest(request.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Request Declined', '', [{ text: 'OK', onPress: () => navigation.goBack() }]);
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Failed', 'Could not decline the request. Please try again.');
          } finally {
            setIsProcessing(false);
          }
        },
      },
    ]);
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusInfo = () => {
    if (!request) return null;

    const isExpired = new Date(request.expiresAt) < new Date();

    switch (request.status) {
      case 'pending':
        return isExpired
          ? { text: 'Expired', color: '#8E8E93', icon: '⏰' }
          : { text: 'Pending', color: '#FFA500', icon: '⏳' };
      case 'accepted':
        return { text: 'Accepted', color: '#34C759', icon: '✅' };
      case 'declined':
        return { text: 'Declined', color: '#FF3B30', icon: '❌' };
      default:
        return { text: request.status, color: '#8E8E93', icon: '📄' };
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading request...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>😕</Text>
        <Text style={styles.errorTitle}>Request Not Found</Text>
        <Text style={styles.errorText}>
          This request may have been deleted or you may not have permission to view it.
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusInfo = getStatusInfo();
  const isExpired = new Date(request.expiresAt) < new Date();
  const canAccept = request.type === 'incoming' && request.status === 'pending' && !isExpired;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo?.color + '20' }]}>
          <Text style={styles.statusIcon}>{statusInfo?.icon}</Text>
          <Text style={[styles.statusText, { color: statusInfo?.color }]}>
            {statusInfo?.text}
          </Text>
        </View>

        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Amount Requested</Text>
          <Text style={styles.amountValue}>{formatCurrency(request.amount)}</Text>
          {requestType === 'incoming' && (
            <Text style={styles.amountSubtext}>
              Your balance: ${balance.toFixed(2)}
            </Text>
          )}
        </View>

        {/* Request Details */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>Request Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>From</Text>
            <Text style={styles.detailValue}>{request.fromUserName}</Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Requested</Text>
            <Text style={styles.detailValue}>{formatDate(request.createdAt)}</Text>
          </View>

          <View style={styles.detailDivider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expires</Text>
            <Text style={styles.detailValue}>{formatDate(request.expiresAt)}</Text>
          </View>

          {request.note && (
            <>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Note</Text>
                <Text style={styles.detailNote}>{request.note}</Text>
              </View>
            </>
          )}
        </View>

        {/* Actions */}
        {canAccept && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.declineButton]}
              onPress={handleDecline}
              disabled={isProcessing}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAccept}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.acceptButtonText}>
                  Pay {formatCurrency(request.amount)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {isExpired && (
          <View style={styles.expiredNotice}>
            <Text style={styles.expiredNoticeText}>
              This request has expired. Ask the sender to create a new request.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#333333',
  },
  amountSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  detailRow: {
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  detailNote: {
    fontSize: 16,
    fontWeight: '400',
    color: '#333333',
    fontStyle: 'italic',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  declineButton: {
    backgroundColor: '#F5F5F5',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  acceptButton: {
    backgroundColor: '#007AFF',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  expiredNotice: {
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
  },
  expiredNoticeText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
});
