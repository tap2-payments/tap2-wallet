import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Enums for type-safe status and type fields
export const transactionStatusEnum = ['PENDING', 'COMPLETED', 'FAILED'] as const;
export type TransactionStatus = (typeof transactionStatusEnum)[number];

export const transactionTypeEnum = ['PAYMENT', 'P2P', 'FUND', 'WITHDRAW'] as const;
export type TransactionType = (typeof transactionTypeEnum)[number];

export const paymentTypeEnum = ['NFC', 'QR'] as const;
export type PaymentType = (typeof paymentTypeEnum)[number];

export const p2pTransferStatusEnum = ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type P2PTransferStatus = (typeof p2pTransferStatusEnum)[number];

// User model - Custom Auth
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    phone: text('phone').notNull().unique(),
    passwordHash: text('password_hash'), // Argon2id hash (NULL for social auth)
    socialProvider: text('social_provider'), // 'apple', 'google', or NULL for password
    socialId: text('social_id'), // Provider's user ID
    kycVerified: integer('kyc_verified', { mode: 'boolean' }).default(false).notNull(),
    kycVerifiedAt: integer('kyc_verified_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    phoneIdx: index('users_phone_idx').on(table.phone),
    socialIdx: index('users_social_idx').on(table.socialProvider, table.socialId),
  })
);

// Wallet model
export const wallets = sqliteTable(
  'wallets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    balance: integer('balance').default(0).notNull(), // Stored as cents
    currency: text('currency').default('USD').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('wallets_user_id_idx').on(table.userId),
  })
);

// Transaction model
export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    type: text('type', { enum: transactionTypeEnum }).notNull(),
    amount: integer('amount').notNull(), // Stored as cents
    status: text('status', { enum: transactionStatusEnum }).default('PENDING').notNull(),
    referenceId: text('reference_id'),
    metadata: text('metadata'), // JSON string
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    walletIdIdx: index('transactions_wallet_id_idx').on(table.walletId),
    statusIdx: index('transactions_status_idx').on(table.status),
    typeIdx: index('transactions_type_idx').on(table.type),
    createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
    walletIdCreatedAtIdx: index('transactions_wallet_created_idx').on(
      table.walletId,
      table.createdAt
    ),
  })
);

// PaymentMethod model
export const paymentMethods = sqliteTable(
  'payment_methods',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'card', 'bank', 'wallet_balance'
    provider: text('provider'), // 'stripe', 'plaid'
    providerId: text('provider_id'),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
    lastFour: text('last_four'),
    expiryMonth: integer('expiry_month'),
    expiryYear: integer('expiry_year'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('payment_methods_user_id_idx').on(table.userId),
    userIdTypeIdx: index('payment_methods_user_type_idx').on(table.userId, table.type),
  })
);

// Merchant model
export const merchants = sqliteTable(
  'merchants',
  {
    id: text('id').primaryKey(),
    businessName: text('business_name').notNull(),
    tap2Id: text('tap2_id').notNull().unique(),
    businessType: text('business_type'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    tap2IdIdx: index('merchants_tap2_id_idx').on(table.tap2Id),
    isActiveIdx: index('merchants_is_active_idx').on(table.isActive),
  })
);

// MerchantPayment model
export const merchantPayments = sqliteTable(
  'merchant_payments',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .unique()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    paymentMethodId: text('payment_method_id').references(() => paymentMethods.id),
    paymentType: text('payment_type', { enum: paymentTypeEnum }).notNull(),
    qrCodeId: text('qr_code_id'),
    nfcNonce: text('nfc_nonce'),
    tipAmount: integer('tip_amount').default(0).notNull(), // Stored as cents
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    merchantIdIdx: index('merchant_payments_merchant_id_idx').on(table.merchantId),
    merchantIdCreatedAtIdx: index('merchant_payments_merchant_created_idx').on(
      table.merchantId,
      table.createdAt
    ),
    paymentTypeIdx: index('merchant_payments_payment_type_idx').on(table.paymentType),
  })
);

// Rewards model
export const rewards = sqliteTable(
  'rewards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    points: integer('points').default(0).notNull(),
    merchantId: text('merchant_id').references(() => merchants.id),
    transactionId: text('transaction_id').references(() => transactions.id),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('rewards_user_id_idx').on(table.userId),
    userIdExpiresAtIdx: index('rewards_user_expires_idx').on(table.userId, table.expiresAt),
    merchantIdIdx: index('rewards_merchant_id_idx').on(table.merchantId),
  })
);

// P2PTransfer model
export const p2pTransfers = sqliteTable(
  'p2p_transfers',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .unique()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    senderId: text('sender_id')
      .notNull()
      .references(() => users.id),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id),
    amount: integer('amount').notNull(), // Stored as cents
    status: text('status', { enum: p2pTransferStatusEnum }).default('PENDING').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    statusIdx: index('p2p_transfers_status_idx').on(table.status),
    expiresAtIdx: index('p2p_transfers_expires_at_idx').on(table.expiresAt),
    senderIdCreatedAtIdx: index('p2p_transfers_sender_created_idx').on(
      table.senderId,
      table.createdAt
    ),
    recipientIdCreatedAtIdx: index('p2p_transfers_recipient_created_idx').on(
      table.recipientId,
      table.createdAt
    ),
  })
);

// Session model - Custom Auth
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: text('device_id').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    deviceIdIdx: index('sessions_device_id_idx').on(table.deviceId),
    userIdExpiresAtIdx: index('sessions_user_expires_idx').on(table.userId, table.expiresAt),
  })
);

// MFA Secrets model - Custom Auth
export const mfaSecrets = sqliteTable(
  'mfa_secrets',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    secret: text('secret').notNull(), // TOTP secret (encrypted)
    backupCodes: text('backup_codes'), // JSON array of hashed codes
    verified: integer('verified', { mode: 'boolean' }).default(false).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('mfa_secrets_user_id_idx').on(table.userId),
  })
);

// Type exports for relations
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;

export type MerchantPayment = typeof merchantPayments.$inferSelect;
export type NewMerchantPayment = typeof merchantPayments.$inferInsert;

export type Reward = typeof rewards.$inferSelect;
export type NewReward = typeof rewards.$inferInsert;

export type P2PTransfer = typeof p2pTransfers.$inferSelect;
export type NewP2PTransfer = typeof p2pTransfers.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type MfaSecret = typeof mfaSecrets.$inferSelect;
export type NewMfaSecret = typeof mfaSecrets.$inferInsert;
