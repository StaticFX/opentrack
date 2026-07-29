<script lang="ts">
	import KanbanBoard from '$lib/components/board/KanbanBoard.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.board.name} · {data.project.name} · OpenTrack</title></svelte:head>

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
