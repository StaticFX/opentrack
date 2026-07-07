ALTER TABLE "board_columns" ADD COLUMN "roadmap_lane" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "roadmap_enabled" boolean DEFAULT true NOT NULL;