PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`plan_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`expire_at` integer,
	`traffic_used` integer DEFAULT 0 NOT NULL,
	`traffic_total` integer,
	`remark` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_customers`("id", "name", "email", "plan_id", "status", "expire_at", "traffic_used", "traffic_total", "remark", "created_at", "updated_at") SELECT "id", "name", "email", "plan_id", "status", "expire_at", "traffic_used", "traffic_total", "remark", "created_at", "updated_at" FROM `customers`;--> statement-breakpoint
DROP TABLE `customers`;--> statement-breakpoint
ALTER TABLE `__new_customers` RENAME TO `customers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_customers_expire_at` ON `customers` (`expire_at`);--> statement-breakpoint
CREATE INDEX `idx_customers_status` ON `customers` (`status`);