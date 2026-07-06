ALTER TABLE "projects" ADD COLUMN "discord_webhook_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "discord_events" jsonb;