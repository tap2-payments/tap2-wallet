import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import type { RootStackParamList } from './types';

import { useAuth } from '@/contexts/AuthContext';
import { HomeScreen } from '@/screens';
import { KYCScreen } from '@/screens/KYCScreen';
import { LoginScreen } from '@/screens/LoginScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigatorContent(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // TODO: Add a proper loading screen
    return (
      <Stack.Navigator>
        <Stack.Screen name="Loading" options={{ headerShown: false }} component={() => null} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="KYC" component={KYCScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Tap2 Wallet' }} />
          {/* TODO: Add more authenticated screens here */}
        </>
      )}
    </Stack.Navigator>
  );
}

export function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <AppNavigatorContent />
    </NavigationContainer>
  );
}
