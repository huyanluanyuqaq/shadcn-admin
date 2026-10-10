ALTER TABLE `plans` ADD `price_monthly` real;--> statement-breakpoint
ALTER TABLE `plans` ADD `price_quarterly` real;--> statement-breakpoint
ALTER TABLE `plans` ADD `price_semiannual` real;--> statement-breakpoint
ALTER TABLE `plans` ADD `price_yearly` real;--> statement-breakpoint
-- 存量套餐回填：旧模型一行一个周期（price + duration_days），
-- 按 duration_days 把价格映射到对应档位列；非常规周期（非 30/90/180/360）四列留空。
-- 回填后 price / duration_days 两列不再业务使用（schema 中标记 @deprecated）。
UPDATE `plans` SET
  `price_monthly` = CASE `duration_days` WHEN 30 THEN `price` ELSE NULL END,
  `price_quarterly` = CASE `duration_days` WHEN 90 THEN `price` ELSE NULL END,
  `price_semiannual` = CASE `duration_days` WHEN 180 THEN `price` ELSE NULL END,
  `price_yearly` = CASE `duration_days` WHEN 360 THEN `price` ELSE NULL END;
