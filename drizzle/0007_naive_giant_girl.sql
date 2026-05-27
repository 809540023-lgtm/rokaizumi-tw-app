CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`supplierId` int NOT NULL,
	`quantity` int NOT NULL,
	`purchasePrice` decimal(10,2) NOT NULL,
	`totalCost` decimal(12,2) NOT NULL,
	`purchaseDate` timestamp NOT NULL DEFAULT (now()),
	`deliveryDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactPerson` varchar(255),
	`email` varchar(320),
	`phone` varchar(50),
	`address` text,
	`city` varchar(100),
	`country` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplierId_suppliers_id_fk` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE cascade ON UPDATE no action;