# Development Guide

This guide covers local development setup, database configuration, testing, and deployment for the Tap2 Wallet monorepo.

## Prerequisites

Before starting development, ensure you have the following installed:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Cloudflare Wrangler CLI** - `npm install -g wrangler`
- **Git** - [Download](https://git-scm.com/)
- **Expo CLI** (for mobile development) - `npm install -g @expo/cli`

For mobile development, you'll also need:
- **iOS**: Xcode and iOS Simulator (macOS only)
- **Android**: Android Studio and Android Emulator

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/tap2-wallet.git
cd tap2-wallet
```

### 2. Run Setup Script

The setup script will install dependencies and create environment files:

```bash
./scripts/setup.sh
```

Or manually set up each workspace (see below).

### 3. Configure Environment Variables

Each workspace has its own `.env` file. Copy the example files and configure:

```bash
# Backend
cp backend/.env.example backend/.env

# Mobile
cp mobile/.env.example mobile/.env
```

Edit these files with your configuration.

## Local Development

### Starting All Servers

To start all development servers at once:

```bash
./scripts/dev.sh
```

This will start:
- Backend API on http://localhost:8787
- Marketing site on http://localhost:4321
- Mobile Expo server on http://localhost:8081

### Starting Individual Servers

#### Backend (Cloudflare Workers)

```bash
cd backend
npm run dev
```

The backend will be available at http://localhost:8787

#### Mobile (React Native/Expo)

```bash
cd mobile
npm start
```

Open Expo Go app on your device or press `i` for iOS simulator or `a` for Android emulator.

#### Marketing (Astro)

```bash
cd marketing
npm run dev
```

The marketing site will be available at http://localhost:4321

## Database Setup (D1 Local)

Tap2 Wallet uses Cloudflare D1 (SQLite) for the database.

### Local Development Database

The local database is created automatically when you run the setup script. To manually create:

```bash
cd backend

# Create local D1 database
wrangler d1 execute tap2-wallet-db --local --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### Running Migrations

```bash
cd backend

# Generate migration from schema changes
npm run db:generate

# Apply migrations to local database
npm run db:migrate

# Apply migrations to production database
wrangler d1 migrations apply tap2-wallet-db
```

### Database Studio

View and edit your local database using Drizzle Studio:

```bash
cd backend
npm run db:studio
```

### Querying Local Database

```bash
cd backend

# Run a custom query
wrangler d1 execute tap2-wallet-db --local --command "SELECT * FROM users LIMIT 10"
```

### Production Database

The production D1 database is configured in `wrangler.toml`. To create a new production database:

```bash
wrangler d1 create tap2-wallet-db
```

Then update the `database_id` in `wrangler.toml`.

## Testing

### Backend Tests (Vitest)

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui

# Run tests for CI
npm run test:ci
```

### Mobile Tests (Jest)

```bash
cd mobile

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:ci
```

### End-to-End Tests

E2E tests should be added using Detox (for mobile) or Playwright (for web).

## Code Quality

### Linting

```bash
# Backend
cd backend && npm run lint

# Mobile
cd mobile && npm run lint

# Fix issues automatically
npm run lint:fix
```

### Type Checking

```bash
# Backend
cd backend && npm run typecheck

# Mobile
cd mobile && npm run typecheck
```

### Formatting

```bash
# Format with Prettier
npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"
```

## Cloudflare Workers Development

### Wrangler Commands

```bash
cd backend

# Start local development server
npm run dev

# Deploy to production
npm run deploy

# Deploy to preview environment
wrangler deploy --env preview

# View logs
wrangler tail

# View logs for production
wrangler tail --env production
```

### Environment Secrets

For production secrets (don't commit these):

```bash
# Set secret for production
wrangler secret put JWT_SECRET
wrangler secret put STRIPE_SECRET_KEY

# List secrets (values are hidden)
wrangler secret list
```

## Mobile Development

### Expo Development Server

```bash
cd mobile
npm start
```

Available commands in the Expo CLI:
- `w` - Open in web browser
- `i` - Open in iOS simulator
- `a` - Open in Android emulator
- `s` - Generate and send a link with your phone
- `e` - Extract a base64 version of the app

### Building for Production

Using Expo EAS:

```bash
cd mobile

# Login to Expo
eas login

# Configure build (first time only)
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Build locally (faster, requires setup)
eas build --local --platform ios
```

### Testing on Physical Device

1. Install Expo Go from App Store (iOS) or Play Store (Android)
2. Start the dev server: `cd mobile && npm start`
3. Scan the QR code with Expo Go app

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -ti:8787 | xargs kill -9  # macOS/Linux
# or
netstat -ano | findstr :8787    # Windows
```

### Backend: Wrangler Errors

```bash
# Reinstall wrangler
cd backend
npm uninstall wrangler
npm install wrangler@latest

# Clear local D1 database
rm -rf .wrangler
```

### Mobile: Metro Bundler Issues

```bash
cd mobile

# Clear cache
npm start -- --clear

# Reset cache completely
rm -rf node_modules
npm cache clean --force
npm install
```

### Database: Migration Issues

```bash
cd backend

# Reset local database
rm -rf .wrangler

# Re-run migrations
npm run db:migrate
```

## Deployment

### Backend Deployment

```bash
cd backend

# Deploy to production
npm run deploy

# Deploy with specific environment
wrangler deploy --env production
```

### Marketing Site Deployment

```bash
cd marketing

# Build for production
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist
```

### Mobile App Deployment

```bash
cd mobile

# Submit to App Store / Play Store
eas submit --platform ios
eas submit --platform android
```

## CI/CD

GitHub Actions workflows are configured in `.github/workflows/`:

- `backend-ci.yml` - Runs on backend changes
- `mobile-ci.yml` - Runs on mobile changes
- `marketing-ci.yml` - Runs on marketing changes
- `deploy.yml` - Handles deployments

Workflows automatically:
- Run linting
- Run tests
- Check types
- Deploy on merge to main

## Useful Links

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Docs](https://developers.cloudflare.com/d1/)
- [Expo Documentation](https://docs.expo.dev/)
- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)

## Getting Help

- Check the [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Check the [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
- Open a GitHub issue for bugs or questions
- Contact the Tap2 development team for support
