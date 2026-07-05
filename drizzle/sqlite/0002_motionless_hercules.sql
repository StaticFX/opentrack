ALTER TABLE `activity` ADD `project_id` text REFERENCES projects(id);--> statement-breakpoint
CREATE INDEX `activity_project_idx` ON `activity` (`project_id`,`created_at`);