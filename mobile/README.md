# Tap2 Wallet - Mobile App

React Native mobile application for Tap2 Wallet - a consumer-facing digital wallet with tap-to-pay, P2P payments, and rewards integration.

## Tech Stack

- **Framework**: React Native with Expo SDK ~52
- **Language**: TypeScript
- **State Management**: Zustand
- **Navigation**: React Navigation v7
- **HTTP Client**: Axios

## Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~52.0.0 | React Native framework |
| `react` | 18.3.1 | UI library |
| `react-native` | 0.76.6 | Native components |
| `typescript` | ^5.3.3 | Type safety |

### Payment & Hardware

| Package | Purpose |
|---------|---------|
| `react-native-nfc-manager` | NFC tap-to-pay functionality |
| `react-native-vision-camera` | QR code scanning |

### Storage & Security

| Package | Purpose |
|---------|---------|
| `expo-secure-store` | Secure token storage (keychain/keystore) |
| `@react-native-async-storage/async-storage` | Local data persistence |
| `expo-local-authentication` | Biometric authentication (Face ID/Touch ID) |

### Contacts & Notifications

| Package | Purpose |
|---------|---------|
| `react-native-contacts` | Contact picker for P2P payments |
| `expo-notifications` | Push notifications |

### Other Dependencies

| Package | Purpose |
|---------|---------|
| `@react-navigation/native` | Screen navigation |
| `@react-navigation/native-stack` | Stack navigation |
| `react-native-screens` | Native screen optimization |
| `react-native-safe-area-context` | Safe area handling |
| `axios` | HTTP client |
| `zustand` | State management |
| `expo-haptics` | Haptic feedback |

## Installation

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- iOS: Xcode 15+ and CocoaPods
- Android: Android Studio with JDK 17+

### Install Dependencies

```bash
cd mobile
npm install
# or
yarn install
# or
pnpm install
```

## Platform-Specific Setup

### iOS Setup

1. **Install CocoaPods dependencies:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

2. **Configure NFC capability:**
   - Open `ios/tap2wallet.xcworkspace` in Xcode
   - Select the target app
   - Go to "Signing & Capabilities"
   - Add "Near Field Communication Tag Reading" capability

3. **Configure Camera permission:**
   - In Xcode, go to `Info.plist`
   - Ensure `NSCameraUsageDescription` is present

4. **Configure Face ID:**
   - In Xcode, go to `Info.plist`
   - Ensure `NSFaceIDUsageDescription` is present

### Android Setup

1. **Configure NFC permissions:**
   - Open `android/app/src/main/AndroidManifest.xml`
   - Ensure NFC permission is present (already in app.json)

2. **Configure Camera permissions:**
   - Camera permission is included in app.json

3. **Minimum SDK:**
   - Android 6.0 (API 23) or higher required

4. **Build configuration:**
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

## Permissions

### iOS Permissions (Info.plist)

| Key | Description |
|-----|-------------|
| `NSCameraUsageDescription` | Camera access for QR scanning |
| `NSFaceIDUsageDescription` | Face ID for biometric authentication |
| `NSContactsUsageDescription` | Contact access for P2P payments |
| `NFCReaderSessionDescription` | NFC for tap-to-pay |

### Android Permissions (AndroidManifest.xml)

| Permission | Purpose |
|------------|---------|
| `NFC` | NFC tap-to-pay |
| `CAMERA` | QR code scanning |
| `USE_BIOMETRIC` | Biometric authentication |
| `USE_FINGERPRINT` | Fingerprint authentication |
| `READ_CONTACTS` | Contact picker |
| `WRITE_CONTACTS` | Add new contacts |
| `POST_NOTIFICATIONS` | Push notifications |

## Development

### Start the development server:

```bash
# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in web browser (limited functionality)
npm run web
```

### Deep Linking

The app supports deep linking with the `tap2wallet://` scheme:

- `tap2wallet://wallet` - Open wallet screen
- `tap2wallet://send/{userId}` - Send money to user
- `tap2wallet://request/{amount}` - Request money
- `tap2wallet://payment/{merchantId}` - Make payment
- `tap2wallet://transaction/{id}` - View transaction

See `navigation.config.js` for full deep link configuration.

## TypeScript Configuration

The project uses path aliases for cleaner imports:

```typescript
import Button from '@/components/Button';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/api';
```

Available aliases:
- `@/*` - Points to `./src/*`
- `@/components/*` - UI components
- `@/screens/*` - Screen components
- `@/navigation/*` - Navigation configuration
- `@/services/*` - API and services
- `@/store/*` - State management
- `@/utils/*` - Utility functions
- `@/types/*` - TypeScript types
- `@/hooks/*` - Custom React hooks
- `@/constants/*` - App constants

## Building for Production

### iOS (EAS Build)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure build
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Local Android Build

```bash
cd android
./gradlew assembleRelease
```

The APK will be in `android/app/build/outputs/apk/release/`.

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## Linting

```bash
# Run ESLint
npm run lint

# Fix linting issues
npm run lint -- --fix
```

## Troubleshooting

### NFC not working on Android

- Ensure NFC is enabled in device settings
- Check that the device has NFC hardware
- Verify the permission is granted in app settings

### Camera not working

- Check that camera permission is granted
- On iOS, ensure camera usage description is in Info.plist
- On Android, verify CAMERA permission in app.json

### Biometric authentication fails

- Ensure device has biometric hardware configured
- Check that biometric permission is granted
- Verify the user has enrolled fingerprints/Face ID

### Metro bundler cache issues

```bash
# Clear Metro cache
npx expo start -c

# Clear node modules and reinstall
rm -rf node_modules
npm install
```

## Project Structure

```
mobile/
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # Screen components
│   ├── navigation/      # Navigation configuration
│   ├── services/        # API and business logic
│   ├── store/           # Zustand state management
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   ├── hooks/           # Custom React hooks
│   └── constants/       # App constants
├── assets/              # Images, fonts, etc.
├── android/             # Android native code
├── ios/                 # iOS native code
├── app.json             # Expo configuration
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
└── navigation.config.js # Deep linking configuration
```

## Contributing

See the main project README for contribution guidelines.

## License

Copyright (c) 2026 Tap2 / CloudMind Inc. All rights reserved.
