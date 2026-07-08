ALTER TABLE `api_keys` ADD `scopes` text;
--> statement-breakpoint
-- Existing keys predate scopes → grant full access (backward compatible).
UPDATE `api_keys` SET `scopes` = '["read","write"]' WHERE `scopes` IS NULL;
