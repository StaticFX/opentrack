import { db, schema } from '$lib/server/db';
import { getApp, githubConfigured } from '$lib/server/github/app';
import { enqueue } from '$lib/server/jobs/queue';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!(await githubConfigured())) return new Response('GitHub App not configured', { status: 503 });

	const raw = await request.text();
	const signature = request.headers.get('x-hub-signature-256') ?? '';
	const deliveryId = request.headers.get('x-github-delivery') ?? '';
	const event = request.headers.get('x-github-event') ?? '';

	const valid = await (await getApp()).webhooks.verify(raw, signature);
	if (!valid) return new Response('Invalid signature', { status: 401 });

	let payload: Record<string, unknown>;
	try {
		payload = JSON.parse(raw);
	} catch {
		return new Response('Invalid JSON', { status: 400 });
	}
	const action = typeof payload.action === 'string' ? payload.action : null;

	// Idempotent: unique delivery id. A replay inserts nothing → we ack without re-processing.
	const inserted = await db
		.insert(schema.githubWebhookEvents)
		.values({ deliveryId, event, action, payload })
		.onConflictDoNothing()
		.returning({ id: schema.githubWebhookEvents.id });

	if (inserted.length > 0) {
		await enqueue('github:webhook', { eventId: inserted[0].id });
	}
	return new Response('ok', { status: 200 });
};
