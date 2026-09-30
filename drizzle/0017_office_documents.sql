CREATE TABLE `office_document_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` varchar(40) NOT NULL,
	`version` int NOT NULL,
	`content` json NOT NULL,
	`note` varchar(255),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `office_document_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `office_documents` (
	`id` varchar(40) NOT NULL,
	`ownerId` int,
	`title` varchar(255) NOT NULL,
	`kind` enum('sheet','doc') NOT NULL,
	`templateKey` varchar(80),
	`currentVersion` int NOT NULL DEFAULT 1,
	`content` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `office_documents_id` PRIMARY KEY(`id`)
);
