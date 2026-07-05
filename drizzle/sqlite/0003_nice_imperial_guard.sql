CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`encrypted` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
