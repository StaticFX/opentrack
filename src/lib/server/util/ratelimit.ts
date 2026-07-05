// Simple in-memory fixed-window rate limiter. Good enough for a single instance;
// swap for a Postgres/Redis-backed limiter if scaling horizontally.
const globalForRL = globalThis as unknown as { __otRL?: Map<string, { count: number; reset: number }> };
const buckets = globalForRL.__otRL ?? new Map<string, { count: number; reset: number }>();
if (!globalForRL.__otRL) globalForRL.__otRL = buckets;

/** Returns true if the action is allowed, false if the limit is exceeded. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
	const now = Date.now();
	const b = buckets.get(key);
	if (!b || now > b.reset) {
		buckets.set(key, { count: 1, reset: now + windowMs });
		return true;
	}
	if (b.count >= limit) return false;
	b.count++;
	return true;
}
