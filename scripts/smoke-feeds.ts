import '$lib/server/load-env';
import { closeDb } from '$lib/server/db';
import { renderRss } from '$lib/server/feed';

function assert(cond: unknown, msg: string) {
	if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
	console.log(`  ✓ ${msg}`);
}

async function main() {
	console.log('[1] well-formed channel + self link');
	const xml = renderRss({
		title: 'Proj — Releases',
		link: 'https://x.io/w/p/releases',
		description: 'Changelog',
		selfLink: 'https://x.io/w/p/releases/rss.xml',
		items: [
			{ title: 'v1.0', link: 'https://x.io/w/p/releases', guid: 'r1', date: new Date('2026-01-02T00:00:00Z'), html: '<p>Hi</p>' }
		]
	});
	assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML prolog present');
	assert(xml.includes('<rss version="2.0"'), 'rss 2.0 root');
	assert(xml.includes('<atom:link href="https://x.io/w/p/releases/rss.xml" rel="self"'), 'atom self link');
	assert(xml.includes('<item>') && xml.includes('<guid isPermaLink="false">r1</guid>'), 'item + guid');
	assert(xml.includes('<pubDate>') && xml.includes('2026'), 'pubDate rendered');
	assert(xml.includes('<![CDATA[<p>Hi</p>]]>'), 'html body wrapped in CDATA');

	console.log('[2] XML escaping of special chars in titles');
	const esc = renderRss({
		title: 'A & B <c> "d"',
		link: 'https://x.io',
		description: 'x',
		selfLink: 'https://x.io/rss.xml',
		items: [{ title: 'fix <script> & stuff', link: 'https://x.io/1', guid: 'g1' }]
	});
	assert(esc.includes('A &amp; B &lt;c&gt;'), 'channel title escaped');
	assert(esc.includes('fix &lt;script&gt; &amp; stuff'), 'item title escaped');
	assert(!esc.includes('<script>'), 'no raw markup injected');

	console.log('[3] empty feed is still valid');
	const empty = renderRss({ title: 'Empty', link: 'https://x.io', description: 'none', selfLink: 'https://x.io/rss.xml', items: [] });
	assert(empty.includes('</channel>') && empty.includes('</rss>'), 'empty feed closes tags');
	assert(!empty.includes('<item>'), 'no items');

	console.log('\n✅ smoke-feeds passed');
	await closeDb();
}

main().catch(async (err) => {
	console.error('\n❌ smoke-feeds failed:', err);
	await closeDb();
	process.exit(1);
});
