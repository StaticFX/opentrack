ALTER TABLE `github_installations` ADD `workspace_id` text REFERENCES workspaces(id);--> statement-breakpoint
CREATE INDEX `gh_installation_ws_idx` ON `github_installations` (`workspace_id`);