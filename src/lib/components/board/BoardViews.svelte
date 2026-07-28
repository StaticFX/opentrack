<script lang="ts">
	import { onMount } from 'svelte';
	import { ListFilter, Plus, Trash2, Users, Check } from '@lucide/svelte';
	import { clickOutside } from '$lib/utils/clickOutside';
	import type { BoardFilters } from '$lib/board';

	type View = { id: string; name: string; filters: BoardFilters; shared: boolean; mine: boolean };

	type Props = {
		boardId: string;
		current: BoardFilters;
		filterActive: boolean;
		canShare: boolean;
		onapply: (f: BoardFilters) => void;
	};
	let { boardId, current, filterActive, canShare, onapply }: Props = $props();

	let open = $state(false);
	let views = $state<View[]>([]);
	let name = $state('');
	let shared = $state(false);
	let saving = $state(false);

	const jsonHeaders = { 'content-type': 'application/json' };

	async function refresh() {
		const res = await fetch(`/api/boards/${boardId}/views`);
		if (res.ok) views = (await res.json()).views;
	}

	function apply(v: View) {
		onapply(v.filters);
		open = false;
	}

	async function save() {
		const trimmed = name.trim();
		if (!trimmed || saving) return;
		saving = true;
		const res = await fetch(`/api/boards/${boardId}/views`, {
			method: 'POST',
			headers: jsonHeaders,
			body: JSON.stringify({ name: trimmed, filters: current, shared })
		});
		saving = false;
		if (res.ok) {
			name = '';
			shared = false;
			await refresh();
		}
	}

	async function remove(v: View, e: MouseEvent) {
		e.stopPropagation();
		views = views.filter((x) => x.id !== v.id); // optimistic
		await fetch(`/api/views/${v.id}`, { method: 'DELETE' });
	}

	onMount(refresh);
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex h-8 items-center gap-1.5 rounded-full border border-black/5 bg-white/70 px-3 text-xs font-semibold text-neutral-500 transition-colors hover:text-neutral-800 dark:border-white/5 dark:bg-neutral-800/70 dark:text-neutral-400 dark:hover:text-neutral-200"
	>
		<ListFilter size={13} /> Views
		{#if views.length}<span class="font-mono text-[11px] text-neutral-400 tabular-nums">{views.length}</span>{/if}
	</button>

	{#if open}
		<div
			use:clickOutside={() => (open = false)}
			class="absolute right-0 top-full z-30 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-black/5 bg-white p-1 shadow-xl dark:border-white/8 dark:bg-neutral-800"
		>
			{#each views as v (v.id)}
				<div
					role="button"
					tabindex="0"
					onclick={() => apply(v)}
					onkeydown={(e) => e.key === 'Enter' && apply(v)}
					class="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
				>
					<span class="min-w-0 flex-1 truncate">{v.name}</span>
					{#if v.shared}<Users size={12} class="shrink-0 text-neutral-400" title="Shared with the team" />{/if}
					{#if v.mine}
						<button
							onclick={(e) => remove(v, e)}
							class="shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-600"
							aria-label="Delete view"
						>
							<Trash2 size={12} />
						</button>
					{/if}
				</div>
			{:else}
				<p class="px-2 py-2 text-xs text-neutral-400">No saved views yet.</p>
			{/each}

			<div class="mt-1 border-t border-black/5 pt-1 dark:border-white/8">
				{#if filterActive}
					<div class="p-1.5">
						<input
							bind:value={name}
							onkeydown={(e) => e.key === 'Enter' && save()}
							placeholder="Name this view…"
							class="h-8 w-full rounded-lg border border-black/10 px-2.5 text-sm focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-glow)] focus-visible:outline-none dark:border-white/10 dark:bg-neutral-900"
						/>
						<div class="mt-2 flex items-center justify-between">
							{#if canShare}
								<label class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
									<input type="checkbox" bind:checked={shared} class="size-3.5 rounded border-neutral-300 accent-[var(--accent-solid)] dark:border-neutral-600 dark:bg-neutral-900" />
									Share with team
								</label>
							{:else}
								<span></span>
							{/if}
							<button
								onclick={save}
								disabled={!name.trim() || saving}
								class="flex items-center gap-1 rounded-full bg-[var(--accent-solid)] px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-[var(--accent-solid-hover)] disabled:opacity-50"
							>
								<Plus size={12} /> Save
							</button>
						</div>
					</div>
				{:else}
					<p class="px-2 py-1.5 text-xs text-neutral-400">Apply a filter to save it as a view.</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
