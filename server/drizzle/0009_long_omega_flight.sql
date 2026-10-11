CREATE TABLE `webhooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`method` text DEFAULT 'POST' NOT NULL,
	`content_type` text DEFAULT 'application/json' NOT NULL,
	`headers` text,
	`body` text,
	`enabled` integer DEFAULT false NOT NULL,
	`event_keys` text DEFAULT '[]' NOT NULL,
	`last_test_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_webhooks_enabled` ON `webhooks` (`enabled`);