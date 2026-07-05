import { pubsub, type RealtimeEvent } from './index';

/**
 * Build an SSE Response that streams events published on `channel`.
 * Sends periodic heartbeats to keep proxies from closing idle connections,
 * and tears down the subscription when the client disconnects.
 */
export function sseResponse(channel: string, signal: AbortSignal): Response {
	let unsubscribe: (() => void) | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const stream = new ReadableStream({
		start(controller) {
			const enc = new TextEncoder();
			const send = (event: string, data: unknown) => {
				try {
					controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					/* controller already closed */
				}
			};

			send('ready', { channel });

			unsubscribe = pubsub.subscribe(channel, (payload) => {
				const evt = payload as RealtimeEvent;
				send(evt?.type ?? 'message', evt);
			});

			heartbeat = setInterval(() => {
				try {
					controller.enqueue(enc.encode(`: ping\n\n`));
				} catch {
					/* closed */
				}
			}, 25_000);

			const close = () => {
				unsubscribe?.();
				if (heartbeat) clearInterval(heartbeat);
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};
			signal.addEventListener('abort', close);
		},
		cancel() {
			unsubscribe?.();
			if (heartbeat) clearInterval(heartbeat);
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive'
		}
	});
}
