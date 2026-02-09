-- Migration: Custom Auth Schema (Sprint 1)
-- This migration adds support for custom authentication system replacing Auth0
--
-- Migration strategy for existing auth0Id data:
-- - Existing auth0Id values will be migrated to socialProvider='auth0', socialId=auth0Id
-- - This allows gradual migration from Auth0 to custom auth
-- - Password users will have passwordHash set and socialProvider/socialId will be NULL
--
-- Changes:
-- 1. Drop auth0Id column and add passwordHash, socialProvider, socialId columns
-- 2. Create sessions table for refresh token storage
-- 3. Create mfa_secrets table for TOTP support
-- 4. Add unique constraint on (socialProvider, socialId) to prevent duplicate social auth accounts
-- 5. Add expiresAt index on sessions table for efficient cleanup queries

-- Step 1: Modify users table - replace auth0Id with passwordHash, socialProvider, socialId
-- SQLite doesn't support ALTER TABLE DROP COLUMN in all versions, so we need to recreate the table
CREATE TABLE `users_new` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL UNIQUE,
	`phone` text NOT NULL UNIQUE,
	`password_hash` text,
	`social_provider` text,
	`social_id` text,
	`kyc_verified` integer DEFAULT 0 NOT NULL,
	`kyc_verified_at` integer,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- Migrate existing data, converting auth0Id to social auth
INSERT INTO `users_new` (id, email, phone, social_provider, social_id, kyc_verified, kyc_verified_at, created_at, updated_at)
SELECT
	id,
	email,
	phone,
	'auth0' as social_provider,
	auth0_id as social_id,
	kyc_verified,
	kyc_verified_at,
	created_at,
	updated_at
FROM `users`;

-- Drop old table and rename new table
DROP TABLE `users`;
ALTER TABLE `users_new` RENAME TO `users`;

-- Recreate indexes for users table
CREATE INDEX `users_email_idx` ON `users` (`email`);
CREATE INDEX `users_phone_idx` ON `users` (`phone`);
-- Unique index on (socialProvider, socialId) - NULL values are ignored, allowing multiple password users
CREATE UNIQUE INDEX `users_social_provider_id_unique` ON `users` (`social_provider`, `social_id`);

-- Step 2: Create sessions table for refresh token storage
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	`device_id` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- Indexes for sessions table
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);
CREATE INDEX `sessions_device_id_idx` ON `sessions` (`device_id`);
-- Standalone expires_at index for cleanup jobs (find expired sessions)
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);
-- Composite index for user session queries
CREATE INDEX `sessions_user_expires_idx` ON `sessions` (`user_id`, `expires_at`);

-- Step 3: Create mfa_secrets table for TOTP support
CREATE TABLE `mfa_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL UNIQUE REFERENCES `users`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	`secret` text NOT NULL,
	`backup_codes` text,
	`verified` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);

-- Index for mfa_secrets table
CREATE INDEX `mfa_secrets_user_id_idx` ON `mfa_secrets` (`user_id`);
