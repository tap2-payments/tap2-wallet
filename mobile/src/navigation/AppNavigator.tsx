/**
 * App Navigator
 * Main navigation container with auth flow
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { useAuthStore } from '@/stores/authStore';
import { setNavigationRef } from '@/services/api';

// Auth Screens
import {
  LoginScreen,
  RegisterScreen,
  VerifyEmailScreen,
  VerifyPhoneScreen,
  PINSetupScreen,
  PINVerifyScreen,
  BiometricPromptScreen,
} from '@/screens/auth';

// Main Screens
import { HomeScreen } from '@/screens';

// Wallet Screens
import {
  WalletHomeScreen,
  TransactionsScreen,
  TransactionDetailsScreen,
  FundWalletScreen,
  WithdrawScreen,
  FundingSourcesScreen,
  AddPaymentMethodScreen,
} from '@/screens/wallet';

// Payment Screens
import {
  TapToPayScreen,
  QRPaymentScreen,
  PaymentConfirmationScreen,
  PaymentResultScreen,
  PaymentHistoryScreen,
} from '@/screens/payments';

// Rewards Screens
import {
  RewardsHomeScreen,
  RewardsHistoryScreen,
  RewardsOffersScreen,
  RedeemRewardsScreen,
} from '@/screens/rewards';

// P2P Screens
import {
  SendMoneyScreen,
  SelectRecipientScreen,
  P2PTapScreen,
  PhoneLookupScreen,
  RequestMoneyScreen,
  RequestDetailsScreen,
  SplitBillScreen,
} from '@/screens/p2p';

import type { RootStackParamList, AuthStackParamList, MainStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

/**
 * Auth Stack - Login and registration flow
 */
const AuthStackNavigator: React.FC = () => {
  return (
    <AuthStack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStack.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
      <AuthStack.Screen name="PINSetup" component={PINSetupScreen} />
      <AuthStack.Screen name="BiometricPrompt" component={BiometricPromptScreen} />
    </AuthStack.Navigator>
  );
};

/**
 * Main Stack - App screens after authentication
 */
const MainStackNavigator: React.FC = () => {
  return (
    <MainStack.Navigator
      initialRouteName="WalletHome"
      screenOptions={{
        headerShown: true,
        animation: 'slide_from_right',
        headerStyle: {
          backgroundColor: '#FFFFFF',
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
          color: '#333333',
        },
        headerShadowVisible: false,
      }}
    >
      <MainStack.Screen
        name="WalletHome"
        component={WalletHomeScreen}
        options={{ title: 'Wallet', headerShown: false }}
      />
      <MainStack.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: 'Transactions' }}
      />
      <MainStack.Screen
        name="TransactionDetails"
        component={TransactionDetailsScreen}
        options={{ title: 'Details' }}
      />
      <MainStack.Screen
        name="FundWallet"
        component={FundWalletScreen}
        options={{ title: 'Add Money' }}
      />
      <MainStack.Screen
        name="Withdraw"
        component={WithdrawScreen}
        options={{ title: 'Withdraw' }}
      />
      <MainStack.Screen
        name="FundingSources"
        component={FundingSourcesScreen}
        options={{ title: 'Payment Methods' }}
      />
      <MainStack.Screen
        name="AddPaymentMethod"
        component={AddPaymentMethodScreen}
        options={{ title: 'Add Payment Method' }}
      />
      <MainStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Tap2 Wallet' }}
      />
      {/* Tap-to-Pay Screens */}
      <MainStack.Screen
        name="TapToPay"
        component={TapToPayScreen}
        options={{ title: 'Tap to Pay', headerShown: false, presentation: 'fullScreenModal' }}
      />
      <MainStack.Screen
        name="QRPayment"
        component={QRPaymentScreen}
        options={{ title: 'Scan QR Code', headerShown: false, presentation: 'fullScreenModal' }}
      />
      <MainStack.Screen
        name="PaymentConfirmation"
        component={PaymentConfirmationScreen}
        options={{ title: 'Confirm Payment', headerShown: false }}
      />
      <MainStack.Screen
        name="PaymentResult"
        component={PaymentResultScreen}
        options={{ title: 'Payment Result', headerShown: false }}
      />
      <MainStack.Screen
        name="PaymentHistory"
        component={PaymentHistoryScreen}
        options={{ title: 'Payment History' }}
      />
      {/* Rewards Screens */}
      <MainStack.Screen
        name="Rewards"
        component={RewardsHomeScreen}
        options={{ title: 'Rewards', headerShown: false }}
      />
      <MainStack.Screen
        name="RewardsHistory"
        component={RewardsHistoryScreen}
        options={{ title: 'Points History' }}
      />
      <MainStack.Screen
        name="RewardsOffers"
        component={RewardsOffersScreen}
        options={{ title: 'Browse Offers' }}
      />
      <MainStack.Screen
        name="RedeemRewards"
        component={RedeemRewardsScreen}
        options={{ title: 'Redeem Points' }}
      />
      {/* P2P Screens */}
      <MainStack.Screen
        name="SendMoney"
        component={SendMoneyScreen}
        options={{ title: 'Send Money', headerShown: false }}
      />
      <MainStack.Screen
        name="SelectRecipient"
        component={SelectRecipientScreen}
        options={{ title: 'Select Recipient', headerShown: false }}
      />
      <MainStack.Screen
        name="P2PTap"
        component={P2PTapScreen}
        options={{ title: 'Tap to Connect', headerShown: false, presentation: 'fullScreenModal' }}
      />
      <MainStack.Screen
        name="PhoneLookup"
        component={PhoneLookupScreen}
        options={{ title: 'Send to Phone', headerShown: false }}
      />
      <MainStack.Screen
        name="RequestMoney"
        component={RequestMoneyScreen}
        options={{ title: 'Request Money', headerShown: false }}
      />
      <MainStack.Screen
        name="RequestDetails"
        component={RequestDetailsScreen}
        options={{ title: 'Request Details', headerShown: false }}
      />
      <MainStack.Screen
        name="SplitBill"
        component={SplitBillScreen}
        options={{ title: 'Split Bill', headerShown: false }}
      />
    </MainStack.Navigator>
  );
};

/**
 * Loading Screen - Shows while auth state is being initialized
 */
const LoadingScreen: React.FC = () => {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
};

/**
 * Root Navigator - Handles auth state and routing
 */
export const AppNavigator: React.FC = () => {
  const { isInitialized, isAuthenticated, initialize } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      await initialize();
      setIsInitializing(false);
    };

    initAuth();
  }, []);

  // If still initializing, show loading screen
  if (isInitializing || !isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={(navigator) => {
        if (navigator) {
          setNavigationRef(navigator as any);
        }
      }}
    >
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthStackNavigator} />
        ) : (
          <RootStack.Screen name="Main" component={MainStackNavigator} />
        )}

        {/* PIN Verify - Can be accessed from anywhere */}
        <RootStack.Screen
          name="PINVerify"
          component={PINVerifyScreen}
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />

        {/* Biometric Prompt - Can be accessed from anywhere */}
        <RootStack.Screen
          name="BiometricPrompt"
          component={BiometricPromptScreen}
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
