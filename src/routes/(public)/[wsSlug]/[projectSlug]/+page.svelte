<script lang="ts">
	import { goto } from '$app/navigation';
	import Card from '$lib/components/board/Card.svelte';
	import ColumnIcon from '$lib/components/board/ColumnIcon.svelte';

	let { data } = $props();

	const ticketUrl = (n: number) => `/${data.workspace.slug}/${data.project.slug}/t/${n}`;
	const empty = $derived(data.columns.every((c) => c.tickets.length === 0));
</script>

<svelte:head><title>{data.project.name} — Board</title></svelte:head>

{#if empty}
	<div class="mx-auto max-w-6xl px-4 py-20 text-center text-sm text-neutral-400 sm:px-6">
		Nothing on the public board yet.
	</div>
{:else}
	<div class="overflow-x-auto px-4 py-6 sm:px-6">
		<div class="mx-auto flex w-max items-start gap-3">
			{#each data.columns as col (col.id)}
				<section class="w-72 rounded-xl bg-neutral-50 dark:bg-neutral-900/40">
					<div class="flex items-center gap-2 px-3 py-2.5">
						<ColumnIcon icon={col.icon} color={col.color} />
						<span class="text-sm font-medium">{col.name}</span>
						<span class="text-xs text-neutral-400">{col.tickets.length}</span>
					</div>
					<div class="space-y-2 px-2 pb-2">
						{#each col.tickets as t (t.id)}
							<Card ticket={t} onopen={() => goto(ticketUrl(t.number))} />
						{:else}
							<p class="px-1 py-4 text-center text-xs text-neutral-400">—</p>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>
{/if}
