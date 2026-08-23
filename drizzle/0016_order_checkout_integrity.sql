ALTER TABLE `orders` ADD `stripeSessionId` varchar(255);
--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_stripeSessionId_unique` UNIQUE(`stripeSessionId`);
