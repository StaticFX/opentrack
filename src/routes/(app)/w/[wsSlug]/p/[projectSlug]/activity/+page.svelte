<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Plus, ArrowRight, CircleCheck, MessageSquare, Lightbulb, Tag, Activity as ActivityIcon } from '@lucide/svelte';

	let { data } = $props();
	const base = $derived(`/w/${page.params.wsSlug}/p/${page.params.projectSlug}`);

	function subject(a: any) {
		if (a.subjectType === 'ticket' && a.ticketNumber != null) return `#${a.ticketNumber} ${a.ticketTitle ?? ''}`;
		if (a.subjectType === 'suggestion') return a.suggestionTitle ?? 'a suggestion';
		if (a.subjectType === 'release') return a.releaseVersion ?? 'a release';
		return '';
	}
	function verb(a: any): string {
		switch (a.type) {
			case 'ticket.created': return 'created';
			case 'ticket.moved': return `moved to ${a.data?.column ?? ''} —`;
			case 'ticket.closed': return 'closed';
			case 'ticket.commented': return 'commented on';
			case 'suggestion.created': return 'suggested';
			case 'suggestion.status': return `marked as ${a.data?.status ?? ''} —`;
			case 'release.published': return 'published';
			default: return a.type;
		}
	}
	function icon(t: string) {
		if (t === 'ticket.created') return Plus;
		if (t === 'ticket.moved') return ArrowRight;
		if (t === 'ticket.closed') return CircleCheck;
		if (t === 'ticket.commented') return MessageSquare;
		if (t.startsWith('suggestion')) return Lightbulb;
		if (t.startsWith('release')) return Tag;
		return ActivityIcon;
	}
	function ago(d: string | Date): string {
		const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
		if (s < 60) return 'just now';
		if (s < 3600) return `${Math.floor(s / 60)}m ago`;
		if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
		return `${Math.floor(s / 86400)}d ago`;
	}
</script>

<svelte:head><title>Activity — {data.project.name}</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<a href={base} class="mb-4 inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-600"><ArrowLeft size={14} /> Board</a>
	<h1 class="mb-6 text-xl font-semibold tracking-tight">Activity</h1>

	{#if data.activity.length}
		<ul class="space-y-1">
			{#each data.activity as a (a.id)}
				{@const Icon = icon(a.type)}
				<li class="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
					<div class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
						<Icon size={13} />
					</div>
					<p class="flex-1 text-sm">
						<span class="font-medium">{a.actorName ?? 'Someone'}</span>
						<span class="text-neutral-500">{verb(a)}</span>
						<span>{subject(a)}</span>
						<span class="ml-1 text-xs text-neutral-400">· {ago(a.createdAt)}</span>
					</p>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-400 dark:border-neutral-700">No activity yet.</div>
	{/if}
</div>
