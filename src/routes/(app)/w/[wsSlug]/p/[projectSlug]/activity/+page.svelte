<script lang="ts">
	import { Plus, ArrowRight, CircleCheck, MessageSquare, Lightbulb, Tag, Activity as ActivityIcon } from '@lucide/svelte';
	import ProjectPageHeader from '$lib/components/app/ProjectPageHeader.svelte';

	let { data } = $props();

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

<div class="flex h-full flex-col">
	<ProjectPageHeader section="Activity" />
	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
			{#if data.activity.length}
				<div class="mb-3 flex items-baseline justify-between gap-3">
					<h2 class="pub-label">Project log</h2>
					<span class="shrink-0 font-mono text-[11px] text-neutral-400">{data.activity.length} events</span>
				</div>
				<ol class="space-y-0.5">
					{#each data.activity as a, i (a.id)}
						{@const Icon = icon(a.type)}
						<li
							class="ot-rise flex items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
							style={`--rise-i:${i}`}
						>
							<span class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-black/5 text-neutral-400 dark:bg-white/10">
								<Icon size={11} />
							</span>
							<p class="min-w-0 flex-1 text-[13px] leading-5">
								<span class="font-medium">{a.actorName ?? 'Someone'}</span>
								<span class="text-neutral-500 dark:text-neutral-400">{verb(a)}</span>
								<span class="text-neutral-600 dark:text-neutral-300">{subject(a)}</span>
							</p>
							<span class="shrink-0 font-mono text-[10px] leading-5 text-neutral-400">{ago(a.createdAt)}</span>
						</li>
					{/each}
				</ol>
			{:else}
				<div class="rounded-2xl bg-black/[0.03] py-16 text-center dark:bg-white/[0.04]">
					<p class="text-sm text-neutral-400">No activity yet.</p>
					<p class="mt-1 font-mono text-[11px] text-neutral-400 dark:text-neutral-500">Ticket moves, comments and releases land here.</p>
				</div>
			{/if}
		</div>
	</div>
</div>
