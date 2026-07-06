CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reactions_subject_idx` ON `reactions` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_uq` ON `reactions` (`subject_type`,`subject_id`,`user_id`,`emoji`);