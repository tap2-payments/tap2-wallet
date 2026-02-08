# Tap2 Wallet

A consumer-facing digital wallet that enables tap-to-pay at any Tap2 merchant, P2P payments between users, and integration with loyalty rewards.

## Project Overview

Tap2 Wallet creates the demand side of the Tap2 payment network, allowing users to:

- Pay with a tap at any Tap2 merchant
- Send money to friends instantly
- Earn and redeem rewards automatically
- Track all spending in one place
- Virtual debit card for online purchases
- Connect any bank account or card

## Monorepo Structure

```
tap2-wallet/
├── backend/         # Cloudflare Workers API (Hono + D1 + Drizzle)
├── mobile/          # React Native mobile app (Expo)
├── marketing/       # Astro marketing website
├── docs/            # Project documentation
└── scripts/         # Development scripts
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm/pnpm
- Cloudflare account (for backend deployment)
- Expo CLI (for mobile development)
- iOS Simulator / Xcode (for iOS development)
- Android Studio / Emulator (for Android development)

### One-Time Setup

Run the setup script to install all dependencies and initialize the project:

```bash
./scripts/setup.sh
```

Or manually set up each workspace:

#### Backend

```bash
cd backend
npm install
cp .env.example .env  # Configure environment variables
npm run dev           # Start development server
```

#### Mobile

```bash
cd mobile
npm install
cp .env.example .env  # Configure environment variables
npm start             # Start Expo development server
```

#### Marketing

```bash
cd marketing
npm install
npm run dev           # Start Astro dev server
```

### Development

Start all development servers at once:

```bash
./scripts/dev.sh
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) - Technical architecture and system design
- [Development Guide](./docs/DEVELOPMENT.md) - Local development setup and workflows
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines and code style
- [PRD](./docs/PRD.md) - Product requirements document
- [Epics](./docs/EPICS.md) - User stories and acceptance criteria
- [Progress](./docs/PROGRESS.md) - Sprint progress and current status

## Technology Stack

### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Language**: TypeScript

### Mobile
- **Framework**: React Native (Expo)
- **State**: Zustand
- **Navigation**: React Navigation
- **NFC**: react-native-nfc-manager
- **Biometrics**: expo-local-authentication

### Marketing
- **Framework**: Astro
- **Deployment**: Cloudflare Pages

## Testing

```bash
# Backend tests
cd backend && npm test

# Mobile tests
cd mobile && npm test

# All tests (from root)
npm run test
```

## CI/CD

GitHub Actions workflows are configured for:

- `backend-ci.yml` - Backend linting and testing
- `mobile-ci.yml` - Mobile linting and testing
- `marketing-ci.yml` - Marketing site build and typecheck
- `deploy.yml` - Deployment to production

See `.github/workflows/` for details.

## Deployment

### Backend

```bash
cd backend
npm run deploy
```

### Marketing

```bash
cd marketing
npm run build
npx wrangler pages deploy dist
```

### Mobile

Mobile apps are deployed via Expo EAS. See `mobile/eas.json` for configuration.

## License

Confidential - Copyright 2026 Tap2 / CloudMind Inc.

## Support

For questions or issues, please open a GitHub issue or contact the Tap2 development team.
