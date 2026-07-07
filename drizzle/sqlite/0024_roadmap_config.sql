ALTER TABLE `board_columns` ADD `roadmap_lane` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `roadmap_enabled` integer DEFAULT true NOT NULL;