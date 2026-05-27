ALTER TABLE `products` ADD `costJPY` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `priceUSD` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `profitTWD` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `exchangeRateJPYtoUSD` decimal(10,6) DEFAULT '0.0075' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `exchangeRateUSDtoTWD` decimal(10,2) DEFAULT '30' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `lastRateUpdateAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `profitMargin` decimal(5,2) DEFAULT '2.0' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `internationalShippingCost` decimal(10,2) DEFAULT '0' NOT NULL;