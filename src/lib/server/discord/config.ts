import { eq } from 'drizzle-orm';
import { DEFAULT_DISCORD_EVENTS } from '$lib/discord';
import { decryptSecret, encryptSecret } from '$lib/server/crypto';
import { db, schema } from '$lib/server/db';

export interface DiscordConfig {
	/** Decrypted incoming-webhook URL, or null when not configured. */
	webhookUrl: string | null;
	events: string[];
}

export async function getProjectDiscord(projectId: string): Promise<DiscordConfig> {
	const [row] = await db
		.select({
			url: schema.projects.discordWebhookUrl,
			events: schema.projects.discordEvents
		})
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.limit(1);
	if (!row) return { webhookUrl: null, events: [] };

	let webhookUrl: string | null = null;
	if (row.url) {
		try {
			webhookUrl = decryptSecret(row.url);
		} catch {
			webhookUrl = null; // corrupt/rotated key — treat as unset
		}
	}
	return { webhookUrl, events: (row.events as string[] | null) ?? DEFAULT_DISCORD_EVENTS };
}

export async function setProjectDiscord(
	projectId: string,
	input: { webhookUrl?: string | null; events?: string[] }
): Promise<void> {
	const patch: Record<string, unknown> = { updatedAt: new Date() };
	if (input.webhookUrl !== undefined) {
		patch.discordWebhookUrl = input.webhookUrl ? encryptSecret(input.webhookUrl) : null;
	}
	if (input.events !== undefined) patch.discordEvents = input.events;
	await db.update(schema.projects).set(patch).where(eq(schema.projects.id, projectId));
}

/**
 * Cheap guard for the request path: is Discord configured for this project AND
 * is this event enabled? Avoids decrypting or enqueuing when it's a no-op.
 */
export async function discordEnabledFor(projectId: string, event: string): Promise<boolean> {
	const [row] = await db
		.select({
			url: schema.projects.discordWebhookUrl,
			events: schema.projects.discordEvents
		})
		.from(schema.projects)
		.where(eq(schema.projects.id, projectId))
		.limit(1);
	if (!row?.url) return false;
	const events = (row.events as string[] | null) ?? DEFAULT_DISCORD_EVENTS;
	return events.includes(event);
}
