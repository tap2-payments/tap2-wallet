import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  KYC: {
    onComplete?: () => void;
  };
  PINSetup: undefined;
  Home: undefined;
  Wallet: undefined;
  Settings: undefined;
  Loading: undefined;
};

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
