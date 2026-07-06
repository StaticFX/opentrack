<script lang="ts">
	import { ChevronUp, Lightbulb } from '@lucide/svelte';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';

	let { data } = $props();
	const p = $derived(data.profile);
	const initials = $derived(
		p.displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
	);
</script>

<svelte:head><title>{p.displayName} — OpenTrack</title></svelte:head>

<div class="mx-auto max-w-2xl px-6 py-10">
	<div class="flex items-center gap-4">
		{#if p.avatarUrl}
			<img src={p.avatarUrl} alt="" class="size-16 rounded-full object-cover" />
		{:else}
			<div class="grid size-16 place-items-center rounded-full bg-neutral-200 text-xl font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-200">{initials}</div>
		{/if}
		<div>
			<h1 class="text-2xl font-bold tracking-tight">{p.displayName}</h1>
			<p class="text-sm text-neutral-500">@{p.username} · joined {new Date(p.memberSince).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
		</div>
	</div>

	<div class="mt-6 grid grid-cols-2 gap-3">
		<div class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
			<div class="text-2xl font-bold">{p.stats.submitted}</div>
			<div class="text-xs text-neutral-500">Suggestions submitted</div>
		</div>
		<div class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
			<div class="text-2xl font-bold text-green-600 dark:text-green-400">{p.stats.accepted}</div>
			<div class="text-xs text-neutral-500">Accepted or shipped</div>
		</div>
	</div>

	<h2 class="mt-8 mb-3 text-sm font-semibold text-neutral-500">Recent suggestions</h2>
	{#if p.recent.length}
		<div class="space-y-2">
			{#each p.recent as s (s.id)}
				<a
					href={`/${s.wsSlug}/${s.projSlug}/suggestions/${s.id}`}
					class="flex items-center gap-3 rounded-xl border border-neutral-200 p-3 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
				>
					<span class="flex items-center gap-1 text-xs text-neutral-400"><ChevronUp size={14} /> {s.votes}</span>
					<span class="min-w-0 flex-1 truncate text-sm font-medium">{s.title}</span>
					<span class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={`background:${SUGGESTION_STATUS_META[s.status as keyof typeof SUGGESTION_STATUS_META]?.color ?? '#9ca3af'}22;color:${SUGGESTION_STATUS_META[s.status as keyof typeof SUGGESTION_STATUS_META]?.color ?? '#6b7280'}`}>{SUGGESTION_STATUS_META[s.status as keyof typeof SUGGESTION_STATUS_META]?.label ?? s.status}</span>
					<span class="hidden shrink-0 text-xs text-neutral-400 sm:block">{s.projName}</span>
				</a>
			{/each}
		</div>
	{:else}
		<p class="flex items-center gap-2 rounded-xl border border-dashed border-neutral-200 px-4 py-8 text-sm text-neutral-400 dark:border-neutral-800"><Lightbulb size={15} /> No public suggestions yet.</p>
	{/if}
</div>
