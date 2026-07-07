<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import KanbanBoard from '$lib/components/board/KanbanBoard.svelte';
	import ProjectPageHeader from '$lib/components/app/ProjectPageHeader.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.project.name} · OpenTrack</title></svelte:head>

<div class="flex h-full flex-col">
	<ProjectPageHeader section={data.board.name}>
		{#snippet action()}
			{#if data.canEditContent}
				<Button variant="primary" size="sm" onclick={() => window.dispatchEvent(new CustomEvent('new-ticket'))}>
					<Plus size={15} /> New ticket
				</Button>
			{/if}
		{/snippet}
	</ProjectPageHeader>

	<KanbanBoard
		boardId={data.board.id}
		projectId={data.project.id}
		columns={data.columns}
		tickets={data.tickets}
		labels={data.labels}
		fields={data.fields}
		canEdit={data.canEditContent}
		canManage={data.canManageProject}
		showArchived={data.showArchived}
		currentUser={{ id: data.user.id, displayName: data.user.displayName, avatarUrl: data.user.avatarUrl }}
	/>
</div>
