ALTER TABLE `subscription_pool` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- 存量提供商回填：按 created_at 倒序（此前的默认展示顺序）赋 0 起连续序号，
-- 保证迁移后「自定义排序」的初始顺序与旧版一致；同毫秒创建按 id 倒序打破平局。
UPDATE `subscription_pool` SET `sort_order` = (
  SELECT COUNT(*) FROM `subscription_pool` AS p
  WHERE p.`created_at` > `subscription_pool`.`created_at`
     OR (p.`created_at` = `subscription_pool`.`created_at` AND p.`id` > `subscription_pool`.`id`)
);
