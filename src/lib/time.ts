/** Compact relative-time formatter ("just now", "5m ago", "3d ago"). Client-safe. */
export function ago(d: string | Date): string {
	const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
	if (s < 60) return 'just now';
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
	return new Date(d).toLocaleDateString();
}
