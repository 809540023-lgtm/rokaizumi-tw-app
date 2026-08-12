ALTER TABLE `products` ADD `stock` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `lowStockThreshold` int DEFAULT 5 NOT NULL;