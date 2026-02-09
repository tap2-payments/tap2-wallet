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

export const virtualCardStatusEnum = ['ACTIVE', 'FROZEN', 'CLOSED', 'PENDING'] as const;
export type VirtualCardStatus = (typeof virtualCardStatusEnum)[number];

export const fundingSourceStatusEnum = ['PENDING', 'ACTIVE', 'FAILED', 'EXPIRED'] as const;
export type FundingSourceStatus = (typeof fundingSourceStatusEnum)[number];

// User model
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    phone: text('phone').notNull().unique(),
    auth0Id: text('auth0_id').unique(),
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
    auth0IdIdx: index('users_auth0_id_idx').on(table.auth0Id),
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

// VirtualCard model - Sprint 6
export const virtualCards = sqliteTable(
  'virtual_cards',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardLastFour: text('card_last_four').notNull(),
    cardToken: text('card_token').notNull(), // Tokenized card number from provider
    expiryMonth: integer('expiry_month').notNull(),
    expiryYear: integer('expiry_year').notNull(),
    status: text('status', { enum: virtualCardStatusEnum }).default('PENDING').notNull(),
    provider: text('provider').notNull(), // 'stripe', 'marqeta', etc.
    providerCardId: text('provider_card_id'),
    spendingLimit: integer('spending_limit').default(0), // Daily limit in cents
    spendingLimitResetAt: integer('spending_limit_reset_at', { mode: 'timestamp' }),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    frozenAt: integer('frozen_at', { mode: 'timestamp' }),
    frozenReason: text('frozen_reason'),
    closedAt: integer('closed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('virtual_cards_user_id_idx').on(table.userId),
    statusIdx: index('virtual_cards_status_idx').on(table.status),
    providerCardIdIdx: index('virtual_cards_provider_card_id_idx').on(table.providerCardId),
  })
);

// FundingSource model - Enhanced for Plaid/Stripe integration
export const fundingSources = sqliteTable(
  'funding_sources',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'bank_account', 'debit_card', 'credit_card'
    provider: text('provider').notNull(), // 'plaid', 'stripe'
    providerAccountId: text('provider_account_id'),
    institutionName: text('institution_name'),
    accountLastFour: text('account_last_four'),
    bankName: text('bank_name'),
    accountType: text('account_type'), // 'checking', 'savings', etc.
    isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
    status: text('status', { enum: fundingSourceStatusEnum }).default('PENDING').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
    plaidAccessToken: text('plaid_access_token'),
    plaidItemId: text('plaid_item_id'),
    stripePaymentMethodId: text('stripe_payment_method_id'),
    microDepositsCompleted: integer('micro_deposits_completed', { mode: 'boolean' }).default(false),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }), // For link tokens
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    userIdIdx: index('funding_sources_user_id_idx').on(table.userId),
    userIdTypeIdx: index('funding_sources_user_type_idx').on(table.userId, table.type),
    statusIdx: index('funding_sources_status_idx').on(table.status),
    providerAccountIdIdx: index('funding_sources_provider_account_idx').on(table.providerAccountId),
  })
);

// PaymentRequest model - For P2P payment requests
export const paymentRequests = sqliteTable(
  'payment_requests',
  {
    id: text('id').primaryKey(),
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    payerId: text('payer_id').references(() => users.id, { onDelete: 'set null' }),
    amount: integer('amount').notNull(), // Stored in cents
    description: text('description'),
    status: text('status').default('PENDING').notNull(), // 'PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED'
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    requesterIdIdx: index('payment_requests_requester_id_idx').on(table.requesterId),
    payerIdIdx: index('payment_requests_payer_id_idx').on(table.payerId),
    statusIdx: index('payment_requests_status_idx').on(table.status),
    expiresAtIdx: index('payment_requests_expires_at_idx').on(table.expiresAt),
  })
);

// BillSplit model - For group bill splitting
export const billSplits = sqliteTable(
  'bill_splits',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    totalAmount: integer('total_amount').notNull(), // Stored in cents
    description: text('description'),
    status: text('status').default('ACTIVE').notNull(), // 'ACTIVE', 'SETTLED', 'CANCELLED'
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    creatorIdIdx: index('bill_splits_creator_id_idx').on(table.creatorId),
    statusIdx: index('bill_splits_status_idx').on(table.status),
  })
);

// BillSplitParticipant model - Participants in a bill split
export const billSplitParticipants = sqliteTable(
  'bill_split_participants',
  {
    id: text('id').primaryKey(),
    billSplitId: text('bill_split_id')
      .notNull()
      .references(() => billSplits.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(), // Amount this person owes
    status: text('status').default('PENDING').notNull(), // 'PENDING', 'PAID', 'DECLINED'
    paidAt: integer('paid_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .default(sql`(strftime('%s', 'now'))`)
      .notNull(),
  },
  (table) => ({
    billSplitIdIdx: index('bill_split_participants_bill_split_id_idx').on(table.billSplitId),
    userIdIdx: index('bill_split_participants_user_id_idx').on(table.userId),
    billSplitIdUserIdIdx: index('bill_split_participants_split_user_idx').on(
      table.billSplitId,
      table.userId
    ),
    statusIdx: index('bill_split_participants_status_idx').on(table.status),
  })
);

// Type exports for new models
export type VirtualCard = typeof virtualCards.$inferSelect;
export type NewVirtualCard = typeof virtualCards.$inferInsert;

export type FundingSource = typeof fundingSources.$inferSelect;
export type NewFundingSource = typeof fundingSources.$inferInsert;

export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type NewPaymentRequest = typeof paymentRequests.$inferInsert;

export type BillSplit = typeof billSplits.$inferSelect;
export type NewBillSplit = typeof billSplits.$inferInsert;

export type BillSplitParticipant = typeof billSplitParticipants.$inferSelect;
export type NewBillSplitParticipant = typeof billSplitParticipants.$inferInsert;
