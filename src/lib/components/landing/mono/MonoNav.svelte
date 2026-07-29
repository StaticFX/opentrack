<!--
	MonoNav — thin, quiet, type-first. Wordmark left, a few mono links, one accent
	CTA, a single hairline rule under it. No logo-center-links, no chrome. The page
	commits to dark, so there is no theme toggle.
-->
<script lang="ts">
	type Props = { siteName?: string; demoHref?: string | null; hasShowcase?: boolean };
	let { siteName = 'OpenTrack', demoHref = null, hasShowcase = false }: Props = $props();

	const links = $derived([
		...(hasShowcase
			? [
					{ href: '#board', label: 'Board' },
					{ href: '#feedback', label: 'Feedback' },
					{ href: '#roadmap', label: 'Roadmap' },
					{ href: '#changelog', label: 'Changelog' }
				]
			: []),
		{ href: '#directory', label: 'Directory' }
	]);
</script>

<header class="sticky top-0 z-40 border-b border-[var(--rule)] bg-[color-mix(in_srgb,var(--ground)_88%,transparent)] backdrop-blur-md">
	<div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-6 px-5 sm:px-8">
		<a href="#top" class="mono-focus group inline-flex items-baseline gap-2">
			<span class="mono-display text-[15px] tracking-tight text-[var(--text)]">{siteName}</span>
			<span class="text-[11px] tracking-tight text-[var(--faint)]">/ public tracker</span>
		</a>

		<nav class="hidden items-center gap-6 text-[12px] tracking-tight text-[var(--dim)] md:flex" aria-label="Primary">
			{#each links as l (l.href)}
				<a href={l.href} class="mono-focus transition-colors hover:text-[var(--accent)]">{l.label}</a>
			{/each}
		</nav>

		<div class="flex items-center gap-5 text-[12px]">
			<a
				href="https://github.com/StaticFX/opentrack"
				class="mono-focus hidden tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)] sm:inline"
			>
				GitHub ↗
			</a>
			<a
				href={demoHref ?? 'https://github.com/StaticFX/opentrack'}
				class="mono-focus inline-flex items-center gap-1.5 border border-[var(--accent)] px-3 py-1.5 tracking-tight text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)]"
			>
				{demoHref ? 'Live demo' : 'Source'} →
			</a>
		</div>
	</div>
</header>
