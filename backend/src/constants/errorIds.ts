/**
 * Error ID constants for tracking and support correlation
 *
 * These IDs should be included in error responses and logs to enable
 * tracking issues across the system and correlating user reports with server logs.
 */
export const ErrorIds = {
  // Authentication errors (ERR_AUTH_xxx)
  AUTHENTICATION_FAILED: 'ERR_AUTH_001',
  AUTHENTICATION_MISSING: 'ERR_AUTH_002',
  AUTHENTICATION_INVALID: 'ERR_AUTH_003',

  // Payment errors (ERR_PAY_xxx)
  PAYMENT_INITIATION_FAILED: 'ERR_PAY_001',
  PAYMENT_INSUFFICIENT_FUNDS: 'ERR_PAY_002',
  PAYMENT_NOT_FOUND: 'ERR_PAY_003',
  PAYMENT_COMPLETION_FAILED: 'ERR_PAY_004',
  PAYMENT_INVALID_AMOUNT: 'ERR_PAY_005',

  // Wallet errors (ERR_WAL_xxx)
  WALLET_NOT_FOUND: 'ERR_WAL_001',
  WALLET_CREATE_FAILED: 'ERR_WAL_002',
  WALLET_INSUFFICIENT_FUNDS: 'ERR_WAL_003',

  // Validation errors (ERR_VAL_xxx)
  VALIDATION_FAILED: 'ERR_VAL_001',
  VALIDATION_INVALID_INPUT: 'ERR_VAL_002',

  // Resource errors (ERR_RES_xxx)
  RESOURCE_NOT_FOUND: 'ERR_RES_001',
  RESOURCE_ALREADY_EXISTS: 'ERR_RES_002',

  // Database errors (ERR_DB_xxx)
  DATABASE_CONNECTION_FAILED: 'ERR_DB_001',
  DATABASE_QUERY_FAILED: 'ERR_DB_002',
  DATABASE_CONSTRAINT_VIOLATION: 'ERR_DB_003',

  // Internal errors (ERR_INT_xxx)
  INTERNAL_ERROR: 'ERR_INT_000',
  UNKNOWN_ERROR: 'ERR_INT_999',
} as const;

export type ErrorId = (typeof ErrorIds)[keyof typeof ErrorIds];
