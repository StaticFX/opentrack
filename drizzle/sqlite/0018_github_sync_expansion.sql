CREATE TABLE `milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`state` text DEFAULT 'open' NOT NULL,
	`due_date` integer,
	`github_milestone_number` integer,
	`github_milestone_id` text,
	`github_synced_at` integer,
	`position` text DEFAULT 'a0' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestones_project_idx` ON `milestones` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `milestones_gh_number_uq` ON `milestones` (`project_id`,`github_milestone_number`) WHERE "milestones"."github_milestone_number" is not null;--> statement-breakpoint
ALTER TABLE `projects` ADD `github_sync_assignees` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `github_sync_labels` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `github_sync_priority` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `github_sync_milestones` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `milestone_id` text REFERENCES milestones(id);--> statement-breakpoint
ALTER TABLE `tickets` ADD `github_assignees` text;--> statement-breakpoint
CREATE INDEX `tickets_milestone_idx` ON `tickets` (`milestone_id`);