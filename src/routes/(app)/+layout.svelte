<script lang="ts">
	// The app speaks the same three type voices as the public pages, so the
	// faces are loaded here too (the public layout loads its own copy).
	import '@fontsource-variable/instrument-sans';
	import '@fontsource-variable/bricolage-grotesque/opsz.css';
	import '@fontsource-variable/jetbrains-mono';
	import sansUrl from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url';
	import displayUrl from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2?url';
	import { Menu, Search } from '@lucide/svelte';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import CommandPalette from '$lib/components/app/CommandPalette.svelte';
	import NotificationBell from '$lib/components/app/NotificationBell.svelte';
	import Sidebar from '$lib/components/app/Sidebar.svelte';
	import LiveRegion from '$lib/components/public/LiveRegion.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { PROJECT_NAV, isProjectNavActive } from '$lib/projectNav';

	let { children } = $props();

	// Off-canvas sidebar for narrow viewports. Closes automatically on navigation.
	let drawerOpen = $state(false);

	const pd = $derived(page.data as Record<string, unknown>);
	const ws = $derived(pd.workspace as { name: string; slug: string } | undefined);
	const proj = $derived(pd.project as { name: string; slug: string; color?: string | null } | undefined);
	const boards = $derived((pd.boards ?? []) as Array<{ id: string; name: string }>);
	const barTitle = $derived(proj?.name ?? ws?.name ?? 'OpenTrack');
	// The mobile crumb links one level up: project → its overview, ws → its overview.
	const crumbHref = $derived(
		proj && ws ? `/w/${ws.slug}/p/${proj.slug}` : ws ? `/w/${ws.slug}` : '/dashboard'
	);
	const barSection = $derived.by(() => {
		if (!proj || !ws) return null;
		const path = page.url.pathname;
		const base = `/w/${ws.slug}/p/${proj.slug}`;
		if (path.startsWith(`${base}/b/`)) {
			const id = path.slice(base.length + 3).split('/')[0];
			return boards.find((b) => b.id === id)?.name ?? 'Board';
		}
		if (path === base) return null;
		for (const item of PROJECT_NAV) {
			if (!item.external && item.key !== 'overview' && isProjectNavActive(item, path, ws.slug, proj.slug))
				return item.label;
		}
		return null;
	});

	// Recents recorder: last-visited projects/boards feed the palette's Recent
	// group and the dashboard Continue row. Query strings are never recorded.
	function recordRecent() {
		if (!ws || !proj) return;
		const path = page.url.pathname;
		const base = `/w/${ws.slug}/p/${proj.slug}`;
		if (!path.startsWith(base)) return;
		let href = base;
		let label = proj.name;
		let type: 'project' | 'board' = 'project';
		if (path.startsWith(`${base}/b/`)) {
			const id = path.slice(base.length + 3).split('/')[0];
			const board = boards.find((b) => b.id === id);
			if (board) {
				href = `${base}/b/${board.id}`;
				label = `${proj.name} · ${board.name}`;
				type = 'board';
			}
		}
		try {
			type Recent = { href: string; label: string; type: 'project' | 'board'; ts: number };
			const raw = JSON.parse(localStorage.getItem('ot-recents') ?? '[]');
			const list: Recent[] = Array.isArray(raw)
				? raw.filter((r): r is Recent => r && typeof r.href === 'string' && r.href !== href)
				: [];
			list.unshift({ href, label, type, ts: Date.now() });
			localStorage.setItem('ot-recents', JSON.stringify(list.slice(0, 6)));
		} catch {
			/* storage unavailable */
		}
	}
	// afterNavigate also runs on the initial mount, so first paint is recorded too.
	afterNavigate(() => {
		drawerOpen = false;
		recordRecent();
	});

	// The signed-in app commits to the dark mono ground regardless of the
	// visitor's light/dark preference, so the mobile browser chrome is pinned to
	// the mono ink ground.
	const themeColor = '#0b0b0c';
</script>

<svelte:head>
	<link rel="preload" as="font" type="font/woff2" href={sansUrl} crossorigin="anonymous" />
	<link rel="preload" as="font" type="font/woff2" href={displayUrl} crossorigin="anonymous" />
	<meta name="theme-color" content={themeColor} />
</svelte:head>

<!-- The signed-in app wears the high-contrast mono skin: .ot-mono flattens the
     floating-panel chrome (gradient ground, per-project accent, soft cards) to
     the fixed flat-ink language and re-skins every UI-kit primitive underneath.
     accent-scope is kept, but --accent is pinned to mono cobalt (the mono block
     also forces it) — the app is always cobalt, never per-project. -->
<div
	class="ot-mono accent-scope flex h-dvh overflow-hidden"
	style="--accent:#3b5bff;background:var(--ground)"
>
	<Sidebar />

	<!-- Content region: a plain area on the ink ground, split from the rail by the
	     rail's hairline (desktop). No floating panel, no shadow, no rounding. -->
	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<!-- Mobile top bar (hidden on lg where the sidebar is always visible) -->
		<header class="hairline-b flex h-12 shrink-0 items-center gap-1 px-2 lg:hidden">
			<button
				type="button"
				onclick={() => (drawerOpen = true)}
				class="hit focus-ring grid size-9 shrink-0 place-items-center rounded-md text-[var(--dim)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
				aria-label="Open menu"
			>
				<Menu size={20} />
			</button>
			<a
				href={crumbHref}
				class="focus-ring mono-display min-w-0 flex-1 truncate rounded-md px-1 text-[15px] tracking-tight text-[var(--text)]"
			>
				{barTitle}{#if barSection}<span class="text-[13px] font-normal text-[var(--dim)]">
						/ {barSection}</span
					>{/if}
			</a>
			<button
				type="button"
				onclick={() => window.dispatchEvent(new CustomEvent('command-palette'))}
				class="hit focus-ring grid size-9 shrink-0 place-items-center rounded-md text-[var(--dim)] transition-colors hover:bg-white/5 hover:text-[var(--text)]"
				aria-label="Search"
			>
				<Search size={18} />
			</button>
			<NotificationBell variant="icon" />
		</header>

		<main id="main" class="min-w-0 flex-1 overflow-y-auto">
			{@render children()}
		</main>
	</div>

	<!-- Mobile navigation drawer: real dialog semantics (trap, Esc, inert ground).
	     Lives inside the mono scope so the rail inherits the flat-ink skin. -->
	<Sheet bind:open={drawerOpen} side="left" size="sm" ariaLabel="Navigation" class="p-0">
		<Sidebar mode="drawer" onnavigate={() => (drawerOpen = false)} />
	</Sheet>

	<!-- Inside the mono scope so the palette inherits the flat-ink tokens; its
	     fixed overlay still escapes the shell's overflow clipping. -->
	<CommandPalette />
</div>

<LiveRegion />
