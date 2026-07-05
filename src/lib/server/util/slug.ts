/** URL-safe slug from arbitrary text. */
export function slugify(input: string): string {
	const s = input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return s.length > 0 ? s : 'untitled';
}
