-- Migration: Custom Authentication System
-- This migration removes Auth0 dependency and adds custom authentication

-- Drop old Auth0 index
DROP INDEX IF EXISTS `users_auth0_id_idx`;--> statement-breakpoint

-- Drop old Auth0 unique constraint
DROP INDEX IF EXISTS `users_auth0_id_unique`;--> statement-breakpoint

-- Drop old auth0_id column from users table
ALTER TABLE `users` DROP COLUMN IF EXISTS `auth0_id`;--> statement-breakpoint

-- Add new authentication columns to users table
ALTER TABLE `users` ADD COLUMN `password_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `social_provider` text;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `social_id` text;--> statement-breakpoint

-- Create sessions table for refresh token storage
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`refresh_token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

-- Create mfa_secrets table for TOTP support
CREATE TABLE `mfa_secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL UNIQUE,
	`secret` text NOT NULL,
	`backup_codes` text,
	`verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint

-- Create indexes for users table (social auth lookup)
CREATE INDEX `users_social_idx` ON `users` (`social_provider`,`social_id`);--> statement-breakpoint

-- Create unique constraint on (social_provider, social_id) to prevent duplicate social auth accounts
CREATE UNIQUE INDEX `users_social_unique` ON `users` (`social_provider`,`social_id`);--> statement-breakpoint

-- Create indexes for sessions table
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_device_id_idx` ON `sessions` (`device_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_expires_idx` ON `sessions` (`user_id`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_user_device_unique` ON `sessions` (`user_id`,`device_id`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);--> statement-breakpoint

-- Create index for mfa_secrets table
CREATE INDEX `mfa_secrets_user_id_idx` ON `mfa_secrets` (`user_id`);
