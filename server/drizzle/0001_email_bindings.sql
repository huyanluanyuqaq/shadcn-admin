-- 邮箱模块语义变更：邮箱账号 → 邮箱与订阅的绑定关系
--
-- 背景：原 `email_accounts` 存的是「邮箱账号」（邮箱 + 密码 + 提供商 + 客户），
-- 但业务上真正需要管理的是「某个邮箱绑定到哪条订阅」这一关系。
-- 因此删除 `email_providers` 与 `email_accounts`，改建 `email_bindings`：
--   - email 唯一（一对一：同一邮箱同一时间只属于一条订阅）
--   - subscription_id 外键级联删除（订阅被删则绑定失效）
--   - 不再存 password / provider_id / customer_id
--
-- 数据迁移顺序为「建新表 → 搬数据 → 删旧表」，邮箱地址原样保留，
-- status / remark 一并带过；subscription_id 留空 —— 旧数据只有 customer_id，
-- 无法可靠推断出具体订阅（一个客户可有多条订阅），交由用户在界面补绑。
CREATE TABLE `email_bindings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`subscription_id` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`remark` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_bindings_email_unique` ON `email_bindings` (`email`);--> statement-breakpoint
CREATE INDEX `idx_email_bindings_subscription_id` ON `email_bindings` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_email_bindings_status` ON `email_bindings` (`status`);--> statement-breakpoint
INSERT INTO `email_bindings` (`email`, `subscription_id`, `status`, `remark`, `created_at`, `updated_at`)
SELECT
	DISTINCT `email`,
	NULL,
	COALESCE(`status`, 'active'),
	`remark`,
	COALESCE(`created_at`, (unixepoch() * 1000)),
	COALESCE(`updated_at`, (unixepoch() * 1000))
FROM `email_accounts`;--> statement-breakpoint
DROP TABLE `email_accounts`;
--> statement-breakpoint
DROP TABLE `email_providers`;