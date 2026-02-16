# Tap2 Wallet Backend API

Node.js/Express REST API for Tap2 Wallet.

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Security**: Helmet, CORS

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Configure your database URL in `.env`:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/tap2_wallet?schema=public"
```

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run database migrations:

```bash
npm run prisma:migrate
```

6. Start development server:

```bash
npm run dev
```

## API Endpoints

### Health Check

- **GET** `/health` - Server health status
- **GET** `/api/v1/health` - Health check with database

### Wallet

- **GET** `/api/v1/wallet/balance` - Get wallet balance
- **GET** `/api/v1/wallet/transactions` - Get transaction history

### Payments

- **POST** `/api/v1/payments/merchant` - Initiate merchant payment
- **POST** `/api/v1/payments/nfc/initiate` - Initiate NFC payment
- **POST** `/api/v1/payments/qr/process` - Process QR code payment
- **GET** `/api/v1/payments/:id/status` - Get payment status

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm test` - Run tests

## Database Schema

The database schema is defined in `prisma/schema.prisma`.

Key models:

- `User` - User accounts
- `Wallet` - User wallets with balance
- `Transaction` - Payment transactions
- `PaymentMethod` - User payment methods
- `Merchant` - Merchant accounts
- `MerchantPayment` - Merchant payment details
- `P2PTransfer` - P2P money transfers
- `Reward` - Rewards points

## Environment Variables

See `.env.example` for all required environment variables.

## Development

The API runs on port 3001 by default (configurable via `PORT` env var).

Hot reload is enabled in development mode using `tsx watch`.
