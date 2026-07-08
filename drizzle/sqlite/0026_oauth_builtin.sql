ALTER TABLE `oauth_providers` ADD `builtin` integer DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill built-in provider rows from the legacy `settings` oauth.* keys
-- (conditional + idempotent; the old settings rows are left in place).
INSERT INTO `oauth_providers` (`id`,`key`,`label`,`icon`,`authorization_endpoint`,`token_endpoint`,`userinfo_endpoint`,`scopes`,`client_id`,`client_secret`,`enabled`,`builtin`,`created_at`,`updated_at`)
SELECT lower(hex(randomblob(16))), 'github', 'GitHub', 'github', 'https://github.com/login/oauth/authorize', 'https://github.com/login/oauth/access_token', 'https://api.github.com/user', 'read:user user:email', ci.value, cs.value, 1, 1, (strftime('%s','now')*1000), (strftime('%s','now')*1000)
FROM `settings` ci JOIN `settings` cs ON cs.`key` = 'oauth.github.clientSecret'
WHERE ci.`key` = 'oauth.github.clientId' AND ci.value IS NOT NULL AND cs.value IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `oauth_providers` WHERE `key` = 'github');
--> statement-breakpoint
INSERT INTO `oauth_providers` (`id`,`key`,`label`,`icon`,`authorization_endpoint`,`token_endpoint`,`userinfo_endpoint`,`scopes`,`client_id`,`client_secret`,`enabled`,`builtin`,`created_at`,`updated_at`)
SELECT lower(hex(randomblob(16))), 'discord', 'Discord', 'discord', 'https://discord.com/oauth2/authorize', 'https://discord.com/api/oauth2/token', 'https://discord.com/api/users/@me', 'identify email', ci.value, cs.value, 1, 1, (strftime('%s','now')*1000), (strftime('%s','now')*1000)
FROM `settings` ci JOIN `settings` cs ON cs.`key` = 'oauth.discord.clientSecret'
WHERE ci.`key` = 'oauth.discord.clientId' AND ci.value IS NOT NULL AND cs.value IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `oauth_providers` WHERE `key` = 'discord');
--> statement-breakpoint
INSERT INTO `oauth_providers` (`id`,`key`,`label`,`icon`,`authorization_endpoint`,`token_endpoint`,`userinfo_endpoint`,`scopes`,`client_id`,`client_secret`,`enabled`,`builtin`,`created_at`,`updated_at`)
SELECT lower(hex(randomblob(16))), 'modrinth', 'Modrinth', 'modrinth', 'https://modrinth.com/auth/authorize', 'https://api.modrinth.com/_internal/oauth/token', 'https://api.modrinth.com/v2/user', 'USER_READ USER_READ_EMAIL', ci.value, cs.value, 1, 1, (strftime('%s','now')*1000), (strftime('%s','now')*1000)
FROM `settings` ci JOIN `settings` cs ON cs.`key` = 'oauth.modrinth.clientSecret'
WHERE ci.`key` = 'oauth.modrinth.clientId' AND ci.value IS NOT NULL AND cs.value IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `oauth_providers` WHERE `key` = 'modrinth');
