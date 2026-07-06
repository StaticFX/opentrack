// Builds Discord webhook payloads (rich embeds) and posts them. Pure/DI-friendly
// so it can be unit-tested without hitting the network.

export interface DiscordEventData {
	/** Subject headline, e.g. "#3 Fix crash" or a suggestion/release title. */
	title: string;
	/** Absolute or app-relative link to the subject. */
	url?: string;
	/** Short excerpt shown in the embed body. */
	description?: string;
	/** Who triggered the event (display name). */
	actor?: string;
	/** Extra inline fields, e.g. status or column. */
	fields?: Array<{ name: string; value: string }>;
}

const COLORS: Record<string, number> = {
	'ticket.created': 0x6366f1, // indigo
	'ticket.closed': 0x22c55e, // green
	'suggestion.created': 0xf59e0b, // amber
	'suggestion.resolved': 0x8b5cf6, // violet
	'release.published': 0x14b8a6 // teal
};

const HEADLINE: Record<string, string> = {
	'ticket.created': 'New ticket',
	'ticket.closed': 'Ticket closed',
	'suggestion.created': 'New suggestion',
	'suggestion.resolved': 'Suggestion updated',
	'release.published': 'New release'
};

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function buildDiscordPayload(event: string, data: DiscordEventData, origin: string) {
	const link = data.url ? (/^https?:\/\//.test(data.url) ? data.url : origin + data.url) : undefined;
	const fields = [...(data.fields ?? [])];
	if (data.actor) fields.push({ name: 'By', value: clip(data.actor, 64), inline: true } as never);

	return {
		embeds: [
			{
				author: { name: HEADLINE[event] ?? 'OpenTrack' },
				title: clip(data.title, 250),
				url: link,
				description: data.description ? clip(data.description, 500) : undefined,
				color: COLORS[event] ?? 0x6b7280,
				fields: fields.length ? fields.map((f) => ({ inline: true, ...f })) : undefined
			}
		]
	};
}

export type FetchLike = typeof fetch;

export interface PostResult {
	ok: boolean;
	status: number;
}

export async function postDiscord(
	url: string,
	body: unknown,
	fetchImpl: FetchLike = fetch
): Promise<PostResult> {
	const res = await fetchImpl(url, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	return { ok: res.ok, status: res.status };
}
