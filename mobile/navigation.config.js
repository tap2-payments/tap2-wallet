/**
 * Navigation Configuration for Deep Linking
 *
 * This file configures deep linking for the Tap2 Wallet app,
 * allowing users to open specific screens from external links,
 * push notifications, and other apps.
 *
 * Supported deep link formats:
 * - tap2wallet://wallet              -> Opens wallet screen
 * - tap2wallet://send/{userId}       -> Opens send money screen with recipient
 * - tap2wallet://request/{amount}    -> Opens request money screen with amount
 * - tap2wallet://payment/{merchantId}-> Opens payment screen for merchant
 * - tap2wallet://transaction/{id}    -> Opens transaction details
 * - tap2wallet://profile             -> Opens profile settings
 * - tap2wallet://rewards             -> Opens rewards screen
 */

import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from './src/navigation/types';

// Define the linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  // Deep link configuration
  prefixes: ['tap2wallet://', 'https://tap2wallet.com'],

  // Custom function to handle incoming links
  config: {
    // Initial route name
    initialRouteName: 'Home',

    // Screen configurations
    screens: {
      Home: {
        path: 'home',
      },
      Wallet: {
        path: 'wallet',
      },
      SendMoney: {
        path: 'send/:userId?',
        parse: {
          userId: (userId: string) => userId,
        },
      },
      RequestMoney: {
        path: 'request/:amount?',
        parse: {
          amount: (amount: string) => (amount ? parseFloat(amount) : undefined),
        },
      },
      Payment: {
        path: 'payment/:merchantId',
        parse: {
          merchantId: (merchantId: string) => merchantId,
        },
      },
      TransactionDetails: {
        path: 'transaction/:id',
        parse: {
          id: (id: string) => id,
        },
      },
      Profile: {
        path: 'profile',
      },
      Rewards: {
        path: 'rewards',
      },
      Settings: {
        path: 'settings',
      },
      QRScanner: {
        path: 'scan',
      },
      NFCPayment: {
        path: 'nfc-pay',
      },
    },
  },

  // Handle incoming URLs
  async getInitialURL() {
    // Check if app was opened from a deep link
    const url = await Linking.getInitialURL();

    if (url != null) {
      return url;
    }

    // Check if there's an initial notification from opening the app
    // (You can implement push notification handling here)
    return null;
  },

  // Custom function to subscribe to incoming links
  subscribe(listener: (url: string) => void) {
    // Listen to incoming links from deep linking
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      listener(url);
    });

    // You can also add push notification listeners here
    // const notificationSubscription = Notifications.addNotificationResponseReceivedListener(...)

    return () => {
      linkingSubscription.remove();
    };
  },
};

export default linking;
