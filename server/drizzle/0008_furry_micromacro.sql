DROP INDEX `email_bindings_email_unique`;--> statement-breakpoint
ALTER TABLE `email_bindings` ADD `pool_id` integer REFERENCES subscription_pool(id);--> statement-breakpoint
-- 存量绑定回填供应商：取自所绑订阅的 pool_id（email 此前唯一，(email, pool_id) 必然不冲突）
UPDATE `email_bindings` SET `pool_id` = (
  SELECT `pool_id` FROM `subscriptions` WHERE `subscriptions`.`id` = `email_bindings`.`subscription_id`
)
WHERE `subscription_id` IS NOT NULL AND `pool_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_email_bindings_email_pool` ON `email_bindings` (`email`,`pool_id`);--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `email` text;--> statement-breakpoint
-- 存量订阅回填邮箱：取自所绑客户的 email（空串归一为 NULL）
UPDATE `subscriptions` SET `email` = NULLIF(
  (SELECT `email` FROM `customers` WHERE `customers`.`id` = `subscriptions`.`customer_id`),
  ''
)
WHERE `customer_id` IS NOT NULL AND `email` IS NULL;
