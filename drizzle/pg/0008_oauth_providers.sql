CREATE TABLE "oauth_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"icon" text,
	"authorization_endpoint" text NOT NULL,
	"token_endpoint" text NOT NULL,
	"userinfo_endpoint" text NOT NULL,
	"scopes" text DEFAULT 'openid email profile' NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_providers_key_uq" ON "oauth_providers" USING btree ("key");