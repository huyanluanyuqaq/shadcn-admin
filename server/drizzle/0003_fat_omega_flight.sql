ALTER TABLE `customers` ADD `pool_id` integer REFERENCES subscription_pool(id) ON DELETE set null;
