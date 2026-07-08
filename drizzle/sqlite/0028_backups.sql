CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`destination` text NOT NULL,
	`storage_key` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'ok' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `backups_created_idx` ON `backups` (`created_at`);