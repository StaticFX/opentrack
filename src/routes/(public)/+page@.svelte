<!--
	OpenTrack landing — HIGH-CONTRAST MONO.

	One committed aesthetic: a monospace-led, near-black, type-driven page — a
	developer's document/manifesto, not a SaaS brochure. Hierarchy comes from type
	scale, weight, letter-spacing, whitespace, and thin hairline rules — NOT from
	bordered cards. The single bordered panel on the page is the one real live board
	(MonoBoard); everything else is type on the ground separated by space and rules.

	The page renders under the minimal ROOT layout (the `@` keeps it there), so it
	owns its nav + footer, and it COMMITS to dark: all colour is expressed as --*
	tokens scoped to `.land-mono`, self-consistent regardless of the visitor's app
	theme. Live/interactive pieces are the real product, not mocks:
	  · MonoBoard embeds the showcase project's REAL board, wired to SSE.
	  · MonoFeedback uses the REAL UpvoteButton — anonymous votes persist.
	Sections needing a public project hide themselves when there isn't one.

	Fonts: Space Mono 700 (display/headlines) + JetBrains Mono (body/UI/data).
	Everything is monospace. Flat cobalt accent only; no gradients.
-->
<script lang="ts">
	import '@fontsource/space-mono/400.css';
	import '@fontsource/space-mono/700.css';
	import '@fontsource-variable/jetbrains-mono';

	import LiveRegion from '$lib/components/public/LiveRegion.svelte';
	import PublicMeta from '$lib/components/public/PublicMeta.svelte';
	import CookieBanner from '$lib/components/public/CookieBanner.svelte';
	import MonoNav from '$lib/components/landing/mono/MonoNav.svelte';
	import MonoHero from '$lib/components/landing/mono/MonoHero.svelte';
	import MonoFeedback from '$lib/components/landing/mono/MonoFeedback.svelte';
	import MonoRoadmap from '$lib/components/landing/mono/MonoRoadmap.svelte';
	import MonoChangelog from '$lib/components/landing/mono/MonoChangelog.svelte';
	import MonoDirectory from '$lib/components/landing/mono/MonoDirectory.svelte';
	import MonoFooter from '$lib/components/landing/mono/MonoFooter.svelte';

	let { data } = $props();

	const showcase = $derived(data.showcase);
	const demoHref = $derived(showcase ? `/${showcase.wsSlug}/${showcase.slug}` : null);
	const base = $derived(showcase ? `/${showcase.wsSlug}/${showcase.slug}` : '');
	const hasShowcase = $derived(!!showcase);
	const hasDirectory = $derived(data.directory.length > 0);

	const metaDescription = $derived(
		data.totals.projects
			? `Self-hosted, public-by-default issue tracking for open-source & modding communities — public boards, roadmaps, changelogs and anonymous upvoting. ${data.totals.projects} ${data.totals.projects === 1 ? 'project' : 'projects'} in the open, ${data.totals.open} open · ${data.totals.shipped} shipped.`
			: `${data.site.name} — ${data.site.tagline}`
	);
</script>

<PublicMeta title={`${data.site.name} — issue tracking, in public`} description={metaDescription} />

<LiveRegion />

<div class="land-mono min-h-screen antialiased">
	<MonoNav siteName={data.site.name} {demoHref} {hasShowcase} />

	<main id="main">
		<MonoHero {showcase} totals={data.totals} siteName={data.site.name} />

		{#if showcase}
			{#if showcase.suggestions.length}
				<MonoFeedback suggestions={showcase.suggestions} {base} projectName={showcase.name} />
			{/if}
			{#if showcase.roadmapEnabled && showcase.lanes.some((l) => l.count > 0)}
				<MonoRoadmap lanes={showcase.lanes} {base} />
			{/if}
			{#if showcase.releases.length}
				<MonoChangelog releases={showcase.releases} {base} />
			{/if}
		{/if}

		{#if hasDirectory}
			<MonoDirectory workspaces={data.directory} totals={data.totals} />
		{/if}
	</main>

	<MonoFooter siteName={data.site.name} {demoHref} {hasShowcase} />

	<CookieBanner text={data.cookie.text} textEn={data.cookie.textEn} enabled={data.cookie.enabled} />
</div>

<style>
	/* Page-local palette — flat colours only, no gradients. Scoped to .land-mono so
	   the whole page is self-consistent regardless of the visitor's app theme; the
	   page commits to dark. */
	.land-mono {
		--ground: #0b0b0c;
		--raised: #141416;
		--text: #ecece6;
		--dim: #9a9a93;
		--faint: #7d7d76;
		--rule: rgba(255, 255, 255, 0.09);
		--accent: #3b5bff;
		--green: #3fb950;
		--amber: #d29922;

		--font-space: 'Space Mono', ui-monospace, 'SF Mono', monospace;
		--font-jb: 'JetBrains Mono Variable', ui-monospace, 'SF Mono', monospace;

		background: var(--ground);
		color: var(--text);
		font-family: var(--font-jb);
		font-size: 15px;
		line-height: 1.55;
		-webkit-font-smoothing: antialiased;
	}

	/* Kill the light app ground behind the fixed-height viewport (overscroll,
	   short pages). Removed automatically when this page unmounts. */
	:global(body) {
		background: #0b0b0c;
	}

	/* Display voice — Space Mono 700, tight. Global so it reaches child components. */
	:global(.land-mono .mono-display) {
		font-family: var(--font-space);
		font-weight: 700;
	}

	/* One consistent focus ring across every interactive element on the page. */
	:global(.land-mono .mono-focus:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
		border-radius: 2px;
	}

	/* Thin, quiet scrollbars inside the board panel. */
	:global(.land-mono .mono-scroll) {
		scrollbar-width: thin;
		scrollbar-color: var(--faint) transparent;
	}
</style>
