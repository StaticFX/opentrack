import { invalidate } from '$app/navigation';

export interface LiveOptions {
	/** Trailing debounce for coalescing event bursts (ms). Default 300. */
	debounce?: number;
	/** Hard cap so a steady stream still refreshes (ms). Default 2000. */
	maxWait?: number;
	/** Actor id whose own event echoes are ignored. */
	selfId?: string | null;
	/** Called on every accepted raw event (pre-debounce) — drives UI pulses/tickers. */
	onEvent?: (type: string, data: Record<string, unknown>) => void;
}

/**
 * Subscribe an EventSource to an SSE stream and turn its events into debounced
 * `invalidate(key)` calls. Adds 0–400ms jitter so a burst doesn't make every
 * open tab reload in the same tick, and pauses invalidation while the tab is
 * hidden (flushing once when it becomes visible again). Returns a teardown fn
 * for `$effect`/attachment cleanup; EventSource handles reconnects natively.
 */
export function liveInvalidate(sseUrl: string, invalidateKey: string, opts: LiveOptions = {}): () => void {
	const debounceMs = opts.debounce ?? 300;
	const maxWait = opts.maxWait ?? 2000;

	let timer: ReturnType<typeof setTimeout> | null = null;
	let firstEventAt = 0;
	let pendingWhileHidden = false;
	let closed = false;

	const flush = () => {
		if (timer) clearTimeout(timer);
		timer = null;
		firstEventAt = 0;
		if (document.hidden) {
			pendingWhileHidden = true;
			return;
		}
		void invalidate(invalidateKey);
	};

	const schedule = () => {
		const now = Date.now();
		if (!firstEventAt) firstEventAt = now;
		if (timer) clearTimeout(timer);
		const jitter = Math.random() * 400;
		const wait = Math.min(debounceMs + jitter, Math.max(0, firstEventAt + maxWait - now));
		timer = setTimeout(flush, wait);
	};

	const onVisibility = () => {
		if (!document.hidden && pendingWhileHidden) {
			pendingWhileHidden = false;
			void invalidate(invalidateKey);
		}
	};
	document.addEventListener('visibilitychange', onVisibility);

	const es = new EventSource(sseUrl);
	// Events missed while disconnected (deploy, proxy drop, laptop sleep) never
	// replay — resync once on every reconnect so the page can't go stale.
	let firstOpen = true;
	es.onopen = () => {
		if (firstOpen) {
			firstOpen = false;
			return;
		}
		schedule();
	};
	const handle = (e: MessageEvent) => {
		if (closed) return;
		let payload: { data?: Record<string, unknown>; origin?: string } = {};
		try {
			payload = JSON.parse(e.data);
		} catch {
			/* heartbeats/ready aren't JSON we care about */
		}
		if (opts.selfId && payload.origin === opts.selfId) return;
		opts.onEvent?.(e.type, payload.data ?? {});
		schedule();
	};
	// The server re-emits published events under their own `event:` names — we
	// can't enumerate them upfront, so listen to the known families explicitly.
	const EVENTS = [
		'ticket.created',
		'ticket.moved',
		'ticket.updated',
		'ticket.deleted',
		'ticket.commented',
		'ticket.voted',
		'ticket.synced',
		'column.created',
		'column.updated',
		'column.deleted',
		'suggestion.created',
		'suggestion.voted'
	];
	for (const ev of EVENTS) es.addEventListener(ev, handle);

	return () => {
		closed = true;
		if (timer) clearTimeout(timer);
		document.removeEventListener('visibilitychange', onVisibility);
		es.close();
	};
}
