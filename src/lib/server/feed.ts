// Minimal RSS 2.0 renderer (no deps). All text is XML-escaped; rich HTML bodies
// go in CDATA.

function esc(s: string): string {
	return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

export interface FeedItem {
	title: string;
	link: string;
	guid: string;
	/** Raw HTML body (wrapped in CDATA). */
	html?: string;
	date?: Date | null;
}

export interface FeedInput {
	title: string;
	link: string;
	description: string;
	/** Absolute URL of the feed itself (atom:link self). */
	selfLink: string;
	items: FeedItem[];
}

export function renderRss(f: FeedInput): string {
	const now = new Date().toUTCString();
	const items = f.items
		.map((it) => {
			const parts = [
				`<title>${esc(it.title)}</title>`,
				`<link>${esc(it.link)}</link>`,
				`<guid isPermaLink="false">${esc(it.guid)}</guid>`
			];
			if (it.date) parts.push(`<pubDate>${it.date.toUTCString()}</pubDate>`);
			if (it.html) parts.push(`<description><![CDATA[${it.html}]]></description>`);
			return `    <item>\n      ${parts.join('\n      ')}\n    </item>`;
		})
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(f.title)}</title>
    <link>${esc(f.link)}</link>
    <description>${esc(f.description)}</description>
    <atom:link href="${esc(f.selfLink)}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;
}

export function xmlResponse(body: string): Response {
	return new Response(body, {
		headers: {
			'content-type': 'application/rss+xml; charset=utf-8',
			'cache-control': 'public, max-age=300'
		}
	});
}
