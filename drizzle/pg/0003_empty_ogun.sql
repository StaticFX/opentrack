CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text,
	"encrypted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
