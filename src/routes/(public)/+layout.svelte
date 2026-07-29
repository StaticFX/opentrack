<script lang="ts">
	import '@fontsource/space-mono/400.css';
	import '@fontsource/space-mono/700.css';
	import '@fontsource-variable/jetbrains-mono';
	import spaceUrl from '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2?url';
	import jbUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
	import { Compass, LayoutDashboard } from '@lucide/svelte';
	import { onNavigate } from '$app/navigation';
	import LiveRegion from '$lib/components/public/LiveRegion.svelte';

	let { data, children } = $props();

	// Cross-page morphs via the View Transitions API. Feature-checked; skipped
	// for reduced motion. Public pages only — the internal app stays static.
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="preload" as="font" type="font/woff2" href={spaceUrl} crossorigin="anonymous" />
	<link rel="preload" as="font" type="font/woff2" href={jbUrl} crossorigin="anonymous" />
</svelte:head>

<!-- The whole public product tree renders inside .ot-mono: one continuous
     high-contrast monospace document, self-consistent regardless of the
     visitor's app theme (mono commits to dark, so there is no theme toggle). -->
<div class="ot-mono flex min-h-screen flex-col">
	<LiveRegion />

	<header
		class="sticky top-0 z-30 border-b border-[var(--rule)] bg-[color-mix(in_srgb,var(--ground)_88%,transparent)] backdrop-blur-md"
		style="view-transition-name: pub-header"
	>
		<div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
			<div class="flex min-w-0 items-center gap-4">
				{#if data.brand}
					<a href={`/${data.brand.slug}`} class="mono-focus group flex min-w-0 items-center gap-2.5">
						{#if data.brand.avatarUrl}
							<img src={data.brand.avatarUrl} alt="" class="size-7 shrink-0 rounded-sm object-cover" />
						{:else}
							<span
								class="grid size-7 shrink-0 place-items-center rounded-sm text-xs font-bold text-white"
								style={`background:${data.brand.color || 'var(--accent)'}`}
							>
								{#if data.brand.icon}{data.brand.icon}{:else}{data.brand.name.slice(0, 1).toUpperCase()}{/if}
							</span>
						{/if}
						<span class="mono-display truncate text-[15px] tracking-tight text-[var(--text)] transition-colors group-hover:text-[var(--accent)]"
							>{data.brand.name}</span
						>
					</a>
					<!-- A visitor scoped to a workspace/project otherwise has no way "up"
					     except the tiny in-band breadcrumb — give the shell its own exit. -->
					<a
						href="/"
						class="mono-focus hidden items-center gap-1.5 text-[12px] tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)] sm:flex"
					>
						<Compass size={13} /> Directory
					</a>
				{:else}
					<a href="/" class="mono-focus group inline-flex items-baseline gap-2">
						<span class="mono-display text-[15px] tracking-tight text-[var(--text)] transition-colors group-hover:text-[var(--accent)]"
							>{data.siteName}</span
						>
						<span class="text-[11px] tracking-tight text-[var(--faint)]">/ public tracker</span>
					</a>
				{/if}
			</div>

			<div class="flex shrink-0 items-center gap-5 text-[12px]">
				{#if data.user}
					<a
						href="/dashboard"
						class="mono-focus flex items-center gap-1.5 tracking-tight text-[var(--dim)] transition-colors hover:text-[var(--accent)]"
					>
						<LayoutDashboard size={14} /> <span class="hidden sm:inline">Dashboard</span>
					</a>
					<a
						href={`/u/${data.user.username}`}
						aria-label={data.user.displayName}
						title={data.user.displayName}
						class="mono-focus shrink-0"
					>
						{#if data.user.avatarUrl}
							<img
								src={data.user.avatarUrl}
								alt={data.user.displayName}
								class="size-7 rounded-full object-cover ring-1 ring-[var(--rule)]"
							/>
						{:else}
							<span
								class="grid size-7 place-items-center rounded-full border border-[var(--rule)] bg-[var(--raised)] text-[11px] font-semibold text-[var(--dim)]"
							>
								{data.user.displayName.slice(0, 1).toUpperCase()}
							</span>
						{/if}
					</a>
				{:else}
					<a
						href="/auth/login"
						class="mono-focus inline-flex items-center gap-1.5 border border-[var(--accent)] px-3 py-1.5 tracking-tight text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--ground)]"
					>
						Sign in →
					</a>
				{/if}
			</div>
		</div>
	</header>

	<div class="flex-1">
		{@render children()}
	</div>

	<footer class="mt-16 border-t border-[var(--rule)]" style="view-transition-name: pub-footer">
		<div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 sm:px-6">
			<span class="text-[11px] tracking-tight text-[var(--faint)]">
				{#if data.brand}{data.brand.name} · running OpenTrack{:else}{data.siteName} · running OpenTrack{/if}
			</span>
			<a
				href="https://github.com/StaticFX/opentrack"
				class="mono-focus group text-[11px] tracking-tight text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
			>
				Powered by <span class="text-[var(--dim)] group-hover:text-[var(--accent)]">OpenTrack</span> ↗
			</a>
		</div>
	</footer>
</div>

<style>
	/* Kill any light app ground behind the fixed-height viewport (overscroll,
	   short pages) while a public mono page is mounted. */
	:global(body) {
		background: #0b0b0c;
	}
</style>
