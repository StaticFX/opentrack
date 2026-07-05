/** Only allow same-origin absolute paths as redirect targets (prevents open redirects). */
export function safeRedirect(target: string | null | undefined, fallback = '/'): string {
	if (target && target.startsWith('/') && !target.startsWith('//')) return target;
	return fallback;
}
