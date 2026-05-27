ALTER TABLE `suppliers` ADD `code` varchar(10);--> statement-breakpoint
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_code_unique` UNIQUE(`code`);