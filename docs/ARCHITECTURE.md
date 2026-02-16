# Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tap2 Wallet Ecosystem                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐      ┌──────────────────┐                 │
│  │   iOS App        │      │   Android App    │                 │
│  │   React Native   │      │   React Native   │                 │
│  └────────┬─────────┘      └────────┬─────────┘                 │
│           │                         │                            │
│           └───────────┬─────────────┘                            │
│                       │                                          │
│                       ▼                                          │
│           ┌─────────────────────────────────────┐                │
│           │       Cloudflare Edge Network       │                │
│           │   (Workers / Pages Functions)       │                │
│           └─────────────────┬───────────────────┘                │
│                             │                                    │
│       ┌─────────────────────┼─────────────────────┐              │
│       ▼                     ▼                     ▼              │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐        │
│  │ Wallet   │         │ Rewards  │         │ Identity │        │
│  │ Service  │         │ Service  │         │ Service  │        │
│  └────┬─────┘         └────┬─────┘         └────┬─────┘        │
│       │                    │                    │               │
│       ▼                    ▼                    ▼               │
│  ┌──────────────────────────────────────────────────┐         │
│  │           Cloudflare D1 (SQLite)                 │         │
│  └──────────────────────────────────────────────────┘         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Mobile App (Consumer)

| Component  | Technology                 | Rationale                       |
| ---------- | -------------------------- | ------------------------------- |
| Framework  | React Native               | Single codebase for iOS/Android |
| State      | Zustand                    | Lightweight, simple             |
| Navigation | React Navigation           | Standard for RN                 |
| Networking | Axios                      | HTTP client                     |
| NFC        | react-native-nfc-manager   | NFC functionality               |
| Biometrics | react-native-biometrics    | Face ID/Touch ID                |
| Camera     | react-native-vision-camera | QR scanning                     |

### Backend Services

| Component   | Technology                           | Rationale                                     |
| ----------- | ------------------------------------ | --------------------------------------------- |
| API Runtime | Cloudflare Workers / Pages Functions | Edge compute, global distribution             |
| Framework   | Hono                                 | Lightweight, edge-optimized, TypeScript-first |
| Language    | TypeScript                           | Type safety                                   |
| Database    | Cloudflare D1                        | Edge-native SQLite, zero cold starts          |
| ORM         | Drizzle ORM                          | Type-safe, lightweight, D1-optimized          |
| Auth        | Custom (Cloudflare)                  | JWT, Argon2, social OAuth, edge-native        |
| KYC         | Persona                              | Identity verification                         |
| Payments    | Stripe                               | Card processing, payouts                      |
| Email       | Resend                               | Transactional emails                          |
| SMS         | Twilio                               | Phone verification                            |
| Queue       | Cloudflare Queues                    | Async job processing                          |
| Cache       | Cloudflare KV                        | Fast edge reads, rate limiting                |

### Infrastructure

| Component      | Technology                           | Rationale                              |
| -------------- | ------------------------------------ | -------------------------------------- |
| Cloud Platform | Cloudflare                           | All cloud services on single platform  |
| Compute        | Cloudflare Workers / Pages Functions | Edge deployment, global latency        |
| CDN            | Cloudflare CDN                       | Built-in to platform                   |
| Database       | Cloudflare D1                        | Edge-native SQLite, global replication |
| Storage        | Cloudflare R2 / KV                   | Object storage, key-value cache        |
| Monitoring     | Sentry                               | Error tracking                         |
| Analytics      | Cloudflare Web Analytics / Mixpanel  | User analytics                         |
| CI/CD          | GitHub Actions + Wrangler            | Automated deployments                  |

## Service Boundaries

### Wallet Service

**Responsibilities:**

- Balance management
- Transaction processing
- Funding source management
- Virtual card issuance

**APIs:**

```
GET    /v1/wallet/balance
POST   /v1/wallet/fund
POST   /v1/wallet/withdraw
GET    /v1/wallet/transactions
POST   /v1/wallet/funding-sources
```

### Payments Service

**Responsibilities:**

- P2P transfers
- Merchant payments
- Payment processing
- Transaction history

**APIs:**

```
POST   /v1/payments/p2p
POST   /v1/payments/merchant
POST   /v1/payments/qr
GET    /v1/payments/:id/status
```

### Rewards Service

**Responsibilities:**

- Points calculation
- Rewards redemption
- Loyalty program integration
- Rewards history

**APIs:**

```
GET    /v1/rewards/balance
GET    /v1/rewards/history
POST   /v1/rewards/redeem
GET    /v1/rewards/offers
```

### Identity Service

**Responsibilities:**

- User registration/login
- KYC verification
- Profile management
- Security settings

**APIs:**

```
POST   /v1/auth/register
POST   /v1/auth/login
POST   /v1/auth/verify-kyc
GET    /v1/auth/profile
PUT    /v1/auth/profile
```

## Database Schema

### D1 Schema (SQLite)

**Users Table**

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT,  -- Argon2id hash for password auth
  social_provider TEXT,  -- 'apple', 'google', or NULL for password
  social_id TEXT,  -- Provider's user ID
  kyc_verified INTEGER DEFAULT 0,
  kyc_verified_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_social ON users(social_provider, social_id);
```

**Sessions Table (KV-backed, cached in D1)**

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_device_id ON sessions(device_id);
```

**MFA Secrets Table**

```sql
CREATE TABLE mfa_secrets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  secret TEXT NOT NULL,  -- TOTP secret (encrypted)
  backup_codes TEXT,  -- JSON array of hashed backup codes
  verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_mfa_secrets_user_id ON mfa_secrets(user_id);
```

**Wallets Table**

```sql
CREATE TABLE wallets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  balance INTEGER DEFAULT 0,  -- Stored as cents (1/100 of currency unit)
  currency TEXT DEFAULT 'USD',
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
```

**Transactions Table**

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  wallet_id TEXT NOT NULL REFERENCES wallets(id),
  type TEXT NOT NULL,  -- 'payment', 'p2p', 'fund', 'withdraw'
  amount INTEGER NOT NULL,  -- Stored as cents
  status TEXT DEFAULT 'pending',
  reference_id TEXT,
  metadata TEXT,  -- JSON string
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_transactions_wallet_id ON transactions(wallet_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
```

**Rewards Table**

```sql
CREATE TABLE rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  points INTEGER DEFAULT 0,
  merchant_id TEXT,
  transaction_id TEXT REFERENCES transactions(id),
  expires_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX idx_rewards_user_id ON rewards(user_id);
CREATE INDEX idx_rewards_expires_at ON rewards(expires_at);
```

### Drizzle ORM Schema Example

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash'), // Argon2id for password auth
  socialProvider: text('social_provider'), // 'apple', 'google', or NULL
  socialId: text('social_id'), // Provider's user ID
  kycVerified: integer('kyc_verified', { mode: 'boolean' }).default(false),
  kycVerifiedAt: text('kyc_verified_at'),
  createdAt: text('created_at').default(sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`),
  updatedAt: text('updated_at').default(sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  deviceId: text('device_id').notNull(),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`),
});

export const mfaSecrets = sqliteTable('mfa_secrets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  secret: text('secret').notNull(), // TOTP secret (encrypted at rest)
  backupCodes: text('backup_codes'), // JSON array of hashed codes
  verified: integer('verified', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`),
});

export const wallets = sqliteTable('wallets', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  balance: integer('balance').default(0), // Cents
  currency: text('currency').default('USD'),
  createdAt: text('created_at').default(sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`),
  updatedAt: text('updated_at').default(sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id')
    .notNull()
    .references(() => wallets.id),
  type: text('type').notNull(), // 'payment', 'p2p', 'fund', 'withdraw'
  amount: integer('amount').notNull(), // Cents
  status: text('status').default('pending'),
  referenceId: text('reference_id'),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').default(sql`strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`),
});
```

### Financial Data Handling

**Storing Amounts as Integers (Cents):**

- SQLite doesn't have a native `DECIMAL` type
- Store all monetary values as integers (cents)
- `$100.50` → `10050`
- Convert on read/write in application layer

**UUIDs as TEXT:**

- SQLite doesn't have native UUID type
- Store as TEXT, generate in application layer
- Use `crypto.randomUUID()` in Workers

**Metadata as JSON:**

- SQLite has JSON functions but D1 support is limited
- Store as TEXT, parse in application
- For complex queries, consider Durable Objects instead

## Security Considerations

### Authentication

- JWT tokens with short expiration (15 minutes)
- Refresh tokens with rotation
- Device binding for sensitive operations

### Authorization

- Role-based access control (RBAC)
- Per-user resource isolation
- Admin-only operations protected

### Data Protection

- Encryption at rest (database)
- TLS 1.3 in transit
- PII data hashed/salted
- PCI DSS compliance for card data

### Rate Limiting

- Per-user rate limits on API calls
- Stricter limits on payment operations
- IP-based blocking for abuse

## Monitoring & Observability

### Metrics to Track

- API response times (p50, p95, p99)
- Payment success/failure rates
- User registration/conversion
- P2P transaction volume
- Rewards redemption rates

### Alerts

- Payment failures above threshold
- API error rate spikes
- Database connection issues
- Unusual transaction patterns

## Cloudflare Architecture

### Why Cloudflare?

- **Global Edge**: Code runs in 300+ locations worldwide, reducing latency
- **Unified Platform**: Compute, storage, database, DNS on one provider
- **DDoS Protection**: Built-in mitigation at no extra cost
- **Cost Effective**: Pay-per-request, no idle server costs
- **Developer Experience**: Wrangler CLI, TypeScript-first, fast deployments

### Cloudflare Services Used

| Service             | Purpose                | Notes                                       |
| ------------------- | ---------------------- | ------------------------------------------- |
| **Workers**         | API compute            | Edge Functions, sub-millisecond cold starts |
| **Pages Functions** | Full-stack deployments | For static + dynamic content                |
| **D1**              | Database               | Edge SQLite, global replication             |
| **KV**              | Key-value storage      | Fast reads, rate limiting, session data     |
| **R2**              | Object storage         | User files, receipts, profile images        |
| **Queues**          | Async jobs             | Webhook processing, notifications           |
| **Durable Objects** | Stateful operations    | Real-time features, strong consistency      |
| **Analytics**       | Request metrics        | Built-in, no extra code needed              |
| **Zero Trust**      | Access control         | Internal tool access                        |

### Database: D1 + Drizzle

**Why D1?**

- **Edge-Native**: Data co-located with Workers, zero latency
- **Automatic Replication**: Multi-region primary with read replicas
- **Serverless**: Pay-per-query, no connection management
- **SQLite**: Familiar SQL dialect, battle-tested

**Why Drizzle?**

- **D1 Optimized**: First-class Cloudflare Workers support
- **Type-Safe**: TypeScript schema definitions
- **Lightweight**: Smaller bundle than Prisma, faster cold starts
- **SQL-like**: No migration black box, you control the queries
- **No Schema Engine**: Unlike Prisma, doesn't require external binary

```typescript
// Cloudflare Worker with D1 + Drizzle
import { drizzle } from 'drizzle-orm/d1';
import { users, wallets } from './schema';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env) {
    const db = drizzle(env.DB);

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
      with: { user: true },
    });

    return Response.json(wallet);
  },
};
```

### Rate Limiting Strategy

Using Cloudflare KV + Workers:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ User Request │────▶│ KV Check     │────▶│ Allow/Deny   │
│              │     │ (rate limit) │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

Per-user and per-IP limits with auto-expiration.

## Deployment Strategy

### Environments

- **Development**: Local development with mock services
- **Staging**: Pre-production testing environment
- **Production**: Live environment

### CI/CD Pipeline

1. Code push triggers GitHub Actions
2. Run tests (unit, integration, E2E)
3. Build Workers bundle (`wrangler deploy`)
4. Deploy to Cloudflare Workers preview (staging)
5. Run smoke tests
6. Promote to production (manual approval)
7. Route traffic via Cloudflare DNS

## Future Considerations

### Scalability

- **Automatic**: Cloudflare Workers auto-scale globally
- **Database**: D1 automatic multi-region replication
- **Caching**: Cloudflare KV for frequently-accessed data
- **Queues**: Cloudflare Queues for async operations (webhooks, notifications)
- **Durable Objects**: For stateful operations requiring strong consistency

### Feature Expansion

- Virtual card integration
- Budgeting and analytics
- Bill pay features
- Investment/savings integration
