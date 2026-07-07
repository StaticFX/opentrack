CREATE TABLE `project_integrations` (
	`project_id` text NOT NULL,
	`key` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`config` text,
	`secrets` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`project_id`, `key`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
