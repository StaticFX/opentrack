<script lang="ts">
	import { Lock, Globe, Plus } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import KanbanBoard from '$lib/components/board/KanbanBoard.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.project.name} · OpenTrack</title></svelte:head>

<div class="flex h-screen flex-col">
	<header class="flex items-center justify-between border-b border-neutral-200 px-5 py-2.5 dark:border-neutral-800">
		<div class="flex items-center gap-2">
			<span class="size-3 rounded-full" style={`background:${data.project.color ?? '#9ca3af'}`}></span>
			<h1 class="text-sm font-semibold">{data.project.name}</h1>
			{#if data.project.visibility === 'private'}
				<Lock size={13} class="text-neutral-400" />
			{:else if data.project.visibility === 'public'}
				<Globe size={13} class="text-neutral-400" />
			{/if}
			<span class="text-neutral-300 dark:text-neutral-700">/</span>
			<span class="text-sm text-neutral-500">{data.board.name}</span>
		</div>
		{#if data.canEditContent}
			<Button variant="primary" size="sm" onclick={() => window.dispatchEvent(new CustomEvent('new-ticket'))}>
				<Plus size={15} /> New ticket
			</Button>
		{/if}
	</header>

	<KanbanBoard
		boardId={data.board.id}
		projectId={data.project.id}
		columns={data.columns}
		tickets={data.tickets}
		labels={data.labels}
		canEdit={data.canEditContent}
		canManage={data.canManageProject}
		showArchived={data.showArchived}
		currentUser={{ id: data.user.id, displayName: data.user.displayName, avatarUrl: data.user.avatarUrl }}
	/>
</div>
