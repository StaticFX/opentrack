<script lang="ts">
	import { onMount } from 'svelte';
	import { ListFilter, Plus, Trash2, Users } from '@lucide/svelte';
	import type { BoardFilters } from '$lib/board';
	import Popover from '$lib/components/ui/Popover.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';

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

	const triggerClass =
		'focus-ring hit flex h-7 items-center gap-1.5 rounded-full border border-[var(--ot-hairline)] px-2.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200';
</script>

<Popover bind:open placement="bottom-end" class="w-64 p-1">
	{#snippet trigger(tp)}
		<button type="button" {...tp} class={triggerClass}>
			<ListFilter size={13} /> Views
			{#if views.length}<span class="data-mono text-neutral-400">{views.length}</span>{/if}
		</button>
	{/snippet}
	{#snippet content()}
		{#each views as v (v.id)}
			<div
				role="button"
				tabindex="0"
				onclick={() => apply(v)}
				onkeydown={(e) => e.key === 'Enter' && apply(v)}
				class="group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
			>
				<span class="min-w-0 flex-1 truncate">{v.name}</span>
				{#if v.shared}<Users size={12} class="shrink-0 text-neutral-400" title="Shared with the team" />{/if}
				{#if v.mine}
					<button
						onclick={(e) => remove(v, e)}
						class="focus-ring hit shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition-colors group-hover:opacity-100 hover:text-red-600"
						aria-label="Delete view"
					>
						<Trash2 size={12} />
					</button>
				{/if}
			</div>
		{:else}
			<p class="px-2 py-2 text-xs text-neutral-500">No saved views yet.</p>
		{/each}

		<div class="hairline-t mt-1 pt-1">
			{#if filterActive}
				<div class="p-1.5">
					<input
						bind:value={name}
						onkeydown={(e) => e.key === 'Enter' && save()}
						placeholder="Name this view…"
						class="focus-ring h-8 w-full rounded-lg border border-neutral-200 px-2.5 text-sm dark:border-neutral-800 dark:bg-neutral-900"
					/>
					<div class="mt-2 flex items-center justify-between">
						{#if canShare}
							<Checkbox bind:checked={shared} label="Share with team" class="text-xs text-neutral-500 dark:text-neutral-400" />
						{:else}
							<span></span>
						{/if}
						<Button size="sm" variant="accent" pill onclick={save} disabled={!name.trim() || saving} loading={saving}>
							<Plus size={12} /> Save
						</Button>
					</div>
				</div>
			{:else}
				<p class="px-2 py-1.5 text-xs text-neutral-500">Apply a filter to save it as a view.</p>
			{/if}
		</div>
	{/snippet}
</Popover>
