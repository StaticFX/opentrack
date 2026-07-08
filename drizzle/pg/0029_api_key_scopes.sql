ALTER TABLE "api_keys" ADD COLUMN "scopes" jsonb;
--> statement-breakpoint
-- Existing keys predate scopes → grant full access (backward compatible).
UPDATE "api_keys" SET "scopes" = '["read","write"]'::jsonb WHERE "scopes" IS NULL;
