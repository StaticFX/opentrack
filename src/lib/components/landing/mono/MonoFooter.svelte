<!--
	MonoFooter — the landing's own footer (it renders under the minimal root
	layout). Quiet, type-driven, one accent CTA echo. Hairline rule on top.
-->
<script lang="ts">
	type Props = { siteName?: string; demoHref?: string | null; hasShowcase?: boolean };
	let { siteName = 'OpenTrack', demoHref = null, hasShowcase = false }: Props = $props();

	const year = new Date().getFullYear();
	const links = $derived([
		...(hasShowcase
			? [
					{ href: '#feedback', label: 'Feedback' },
					{ href: '#roadmap', label: 'Roadmap' },
					{ href: '#changelog', label: 'Changelog' }
				]
			: []),
		{ href: '#directory', label: 'Directory' }
	]);
</script>

<footer class="mt-8 border-t border-[var(--rule)]">
	<div class="mx-auto max-w-5xl px-5 py-12 sm:px-8">
		<div class="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
			<div class="max-w-md">
				<span class="mono-display text-[15px] tracking-tight text-[var(--text)]">{siteName}</span>
				<p class="mt-3 text-[13px] leading-relaxed text-[var(--dim)]">
					Open-source, self-hosted issue tracking. Boards, roadmaps, and changelogs on public
					URLs, readable without a login.
				</p>
				<a
					href={demoHref ?? 'https://github.com/StaticFX/opentrack'}
					class="mono-focus mt-5 inline-block text-[13px] tracking-tight text-[var(--accent)] transition-opacity hover:opacity-80"
				>
					{demoHref ? 'See the live demo' : 'View the source'} →
				</a>
			</div>

			<nav class="flex flex-col gap-2 text-[13px]" aria-label="Footer">
				{#each links as l (l.href)}
					<a href={l.href} class="mono-focus tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]">
						{l.label}
					</a>
				{/each}
				<a
					href="https://github.com/StaticFX/opentrack"
					class="mono-focus tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
				>
					GitHub ↗
				</a>
			</nav>
		</div>

		<div
			class="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] pt-6 text-[11px] tracking-tight text-[var(--faint)]"
		>
			<span>{siteName} · running OpenTrack</span>
			<span>open-source · self-hosted · © {year}</span>
		</div>
	</div>
</footer>
