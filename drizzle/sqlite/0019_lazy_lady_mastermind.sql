ALTER TABLE `tickets` ADD `github_pr_head_ref` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `github_pr_head_sha` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `github_pr_link_source` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `github_ci_status` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `github_ci_updated_at` integer;