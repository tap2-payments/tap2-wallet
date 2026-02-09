-- Migration: Custom Authentication (replacing Auth0)
-- This migration replaces Auth0 authentication with custom auth implementation

-- Add new columns to users table
ALTER TABLE `users` ADD COLUMN `password_hash` text;
ALTER TABLE `users` ADD COLUMN `social_provider` text; -- 'apple', 'google', or NULL for password
ALTER TABLE `users` ADD COLUMN `social_id` text; -- Provider's user ID

-- Create sessions table for refresh token storage
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_device_id_idx` ON `sessions` (`device_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_expires_idx` ON `sessions` (`user_id`, `expires_at`);

-- Create mfa_secrets table for TOTP support
CREATE TABLE `mfa_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL, -- TOTP secret (encrypted)
	`backup_codes` text, -- JSON array of hashed codes
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	UNIQUE (`user_id`)
);
--> statement-breakpoint
CREATE INDEX `mfa_secrets_user_id_idx` ON `mfa_secrets` (`user_id`);

-- Create composite index for social auth lookup
CREATE INDEX `users_social_idx` ON `users` (`social_provider`, `social_id`);

-- Note: The auth0_id column and index will be dropped in a subsequent migration
-- after verifying all users have been migrated to new auth system
