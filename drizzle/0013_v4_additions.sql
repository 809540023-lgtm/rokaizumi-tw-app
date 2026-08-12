-- v4 新增：Newsletter、B2B 詢價、商品評論
-- 套用方式：在 A 版專案根目錄執行 `pnpm db:push`

CREATE TABLE IF NOT EXISTS `newsletter_subscribers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `email` varchar(255) NOT NULL,
  `source` varchar(50) DEFAULT 'web',
  `coupon_code` varchar(50) NULL,
  `unsubscribed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
  CONSTRAINT `newsletter_subscribers_email_unique` UNIQUE(`email`)
);

CREATE TABLE IF NOT EXISTS `b2b_inquiries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `company` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `email` varchar(255) NULL,
  `type` varchar(50) NOT NULL,
  `monthly_budget` varchar(50) NOT NULL,
  `message` text NULL,
  `status` varchar(20) NOT NULL DEFAULT 'new',
  `internal_note` text NULL,
  `assigned_to` int NULL,
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT `b2b_inquiries_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `product_reviews` (
  `id` int AUTO_INCREMENT NOT NULL,
  `product_id` int NOT NULL,
  `user_id` int NOT NULL,
  `rating` tinyint NOT NULL,
  `title` varchar(255) NULL,
  `body` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  CONSTRAINT `product_reviews_id` PRIMARY KEY(`id`)
);

-- 也建議在 products 表加上欄位（如果還沒有）
-- ALTER TABLE `products` ADD COLUMN `original_price` decimal(10,2) NULL;
-- ALTER TABLE `products` ADD COLUMN `sales_count` int NOT NULL DEFAULT 0;
-- ALTER TABLE `products` ADD COLUMN `is_tax_exempt` tinyint(1) NOT NULL DEFAULT 0;
-- ALTER TABLE `products` ADD COLUMN `sku` varchar(50) NULL;
-- ALTER TABLE `products` ADD COLUMN `brand` varchar(100) NULL;
-- ALTER TABLE `products` ADD COLUMN `name_ja` varchar(255) NULL;
-- ALTER TABLE `products` ADD COLUMN `name_en` varchar(255) NULL;

CREATE INDEX `b2b_inquiries_status_idx` ON `b2b_inquiries` (`status`);
CREATE INDEX `product_reviews_product_idx` ON `product_reviews` (`product_id`);
CREATE INDEX `product_reviews_status_idx` ON `product_reviews` (`status`);
