<!--
	ProductPeek — "here's what's waiting for you" preview shown below the
	fold: a stylized, representative slice of a real OpenTrack project
	(hardcoded per the brief) — a suggestion wall with anonymous upvotes,
	a roadmap swimlane, and a changelog. A client-only interval nudges one
	suggestion's vote count and flashes its border to sell "this is alive"
	without pretending to be a live feed; prefers-reduced-motion leaves it
	as a beautiful static panel.
-->
<script lang="ts">
	import { ChevronUp, GitPullRequest, MessageSquare, Rocket } from '@lucide/svelte';

	type Suggestion = { id: string; title: string; votes: number; tag: string };
	type RoadmapItem = { title: string; status: 'planned' | 'progress' | 'shipped' };
	type Release = { version: string; title: string; date: string };

	const suggestions = $state<Suggestion[]>([
		{ id: 'f-142', title: 'Add dark mode to the public board', votes: 142, tag: 'popular' },
		{ id: 'f-088', title: 'Bulk import from GitHub Issues', votes: 88, tag: 'feature' },
		{ id: 'f-061', title: 'Discord notifications on ticket close', votes: 61, tag: 'integration' }
	]);

	const roadmap: RoadmapItem[] = [
		{ title: 'Custom board automations', status: 'planned' },
		{ title: 'Modrinth OAuth login', status: 'progress' },
		{ title: 'Public roadmap swimlanes', status: 'shipped' }
	];

	const releases: Release[] = [
		{ version: 'v2.4.0', title: 'Public roadmap swimlanes', date: '2d ago' },
		{ version: 'v2.3.0', title: 'GitHub PR auto-link on merge', date: '9d ago' },
		{ version: 'v2.2.0', title: 'Anonymous upvoting', date: '3w ago' }
	];

	const statusMeta: Record<RoadmapItem['status'], { label: string; tone: string }> = {
		planned: { label: 'Planned', tone: 'oklch(0.75 0.03 260)' },
		progress: { label: 'In progress', tone: 'var(--accent-fg)' },
		shipped: { label: 'Shipped', tone: 'oklch(0.76 0.17 155)' }
	};

	let flashId = $state<string | null>(null);

	$effect(() => {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const timer = setInterval(() => {
			const idx = Math.floor(Math.random() * suggestions.length);
			suggestions[idx].votes += 1;
			flashId = suggestions[idx].id;
			setTimeout(() => (flashId = null), 900);
		}, 3200);
		return () => clearInterval(timer);
	});
</script>

<div class="peek-frame overflow-hidden rounded-2xl">
	<div class="flex items-center gap-2 border-b px-4 py-3" style="border-color:var(--ab-line)">
		<span class="flex gap-1.5" aria-hidden="true">
			<span class="size-2.5 rounded-full" style="background:oklch(0.7 0.17 25)"></span>
			<span class="size-2.5 rounded-full" style="background:oklch(0.8 0.15 85)"></span>
			<span class="size-2.5 rounded-full" style="background:oklch(0.76 0.17 155)"></span>
		</span>
		<span
			class="data-mono mx-2 min-w-0 flex-1 truncate rounded-full px-3 py-1 text-center"
			style="background:oklch(1 0 0 / 0.05); color:var(--ab-text-faint)"
		>
			track.devinfritz.de/aetherial
		</span>
		<span class="data-mono flex shrink-0 items-center gap-1.5" style="color:var(--accent-fg)">
			<span class="relative flex size-1.5" aria-hidden="true">
				<span class="ot-breathe absolute inline-flex size-full rounded-full" style="background:var(--accent-fg)"></span>
				<span class="relative inline-flex size-1.5 rounded-full" style="background:var(--accent-fg)"></span>
			</span>
			LIVE
		</span>
	</div>

	<div class="ot-scrollbar grid grid-flow-col auto-cols-[85%] gap-3 overflow-x-auto p-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-3 sm:overflow-visible sm:p-5">
		<div>
			<p class="pub-label px-1" style="color:var(--ab-text-faint)">Suggestions</p>
			<div class="mt-2.5 space-y-2">
				{#each suggestions as s (s.id)}
					<div
						class="peek-card flex items-start gap-2.5 rounded-xl p-2.5 transition-shadow {flashId === s.id ? 'ot-flash' : ''}"
					>
						<span
							class="flex flex-none flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 font-semibold"
							style="color:var(--accent-fg); background:var(--accent-soft)"
						>
							<ChevronUp size={11} />
							<span class="data-mono tabular-nums">{s.votes}</span>
						</span>
						<div class="min-w-0">
							<p class="text-[12.5px] leading-snug font-medium" style="color:var(--ab-text)">{s.title}</p>
							<span class="data-mono mt-1 inline-block" style="color:var(--ab-text-faint)">{s.tag} · anonymous</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div>
			<p class="pub-label px-1" style="color:var(--ab-text-faint)">Roadmap</p>
			<div class="mt-2.5 space-y-2">
				{#each roadmap as r (r.title)}
					<div class="peek-card rounded-xl p-2.5">
						<span
							class="mb-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
							style="background:color-mix(in oklab, {statusMeta[r.status].tone} 18%, transparent); color:{statusMeta[r.status].tone}"
						>
							{statusMeta[r.status].label}
						</span>
						<p class="text-[12.5px] leading-snug font-medium" style="color:var(--ab-text)">{r.title}</p>
					</div>
				{/each}
			</div>
		</div>

		<div>
			<p class="pub-label px-1" style="color:var(--ab-text-faint)">Changelog</p>
			<div class="mt-2.5 space-y-2">
				{#each releases as r (r.version)}
					<div class="peek-card rounded-xl p-2.5">
						<div class="flex items-center gap-1.5" style="color:var(--ab-text-faint)">
							<Rocket size={11} class="text-[var(--accent-fg)]" />
							<span class="data-mono">{r.version}</span>
							<span class="data-mono ml-auto">{r.date}</span>
						</div>
						<p class="mt-1 text-[12.5px] leading-snug font-medium" style="color:var(--ab-text)">{r.title}</p>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-3 sm:px-5" style="border-color:var(--ab-line)">
		<span class="data-mono flex items-center gap-1.5" style="color:var(--ab-text-faint)">
			<MessageSquare size={11} /> 6 open threads
		</span>
		<span class="data-mono flex items-center gap-1.5" style="color:var(--ab-text-faint)">
			<GitPullRequest size={11} /> synced with GitHub
		</span>
		<span class="data-mono ml-auto" style="color:var(--ab-text-faint)">no login required to watch</span>
	</div>
</div>

<style>
	.peek-frame {
		border: 1px solid var(--ab-line-strong);
		background: var(--ab-surface);
		box-shadow: 0 40px 80px -40px oklch(0 0 0 / 0.6);
	}
	.peek-card {
		background: var(--ab-surface-2);
		border: 1px solid var(--ab-line);
	}
</style>
