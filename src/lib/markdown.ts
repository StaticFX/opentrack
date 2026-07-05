import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

/** Render user markdown to sanitized HTML (safe for {@html}). */
export function renderMarkdown(src: string | null | undefined): string {
	if (!src) return '';
	const html = marked.parse(src, { async: false, breaks: true }) as string;
	return DOMPurify.sanitize(html);
}
