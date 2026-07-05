<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { MessageSquare } from '@lucide/svelte';
	import { SUGGESTION_STATUSES } from '$lib/constants';
	import { SUGGESTION_STATUS_META } from '$lib/suggestionStatus';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import UpvoteButton from '$lib/components/UpvoteButton.svelte';

	let { data, form } = $props();

	const base = $derived(`/${data.workspace.slug}/${data.project.slug}/suggestions`);
	const sorts = [
		{ key: 'top', label: 'Top' },
		{ key: 'new', label: 'New' },
		{ key: 'trending', label: 'Trending' }
	];
	const statusOptions = [
		{ value: 'all', label: 'All statuses' },
		...SUGGESTION_STATUSES.map((s) => ({ value: s, label: SUGGESTION_STATUS_META[s].label }))
	];

	function go(params: Record<string, string>) {
		const sp = new URLSearchParams({ sort: data.sort, status: data.status, ...params });
		goto(`${base}?${sp}`, { noScroll: true });
	}

	let showForm = $state(false);
</script>

<svelte:head><title>Suggestions — {data.project.name}</title></svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<!-- Submit -->
	<div class="mb-6">
		{#if data.canSubmit}
			{#if showForm}
				<form method="POST" action="?/submit" use:enhance class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
					<Field label="Suggestion" error={form?.error}>
						<Input name="title" placeholder="What would you like to see?" value={form?.title ?? ''} required autofocus />
					</Field>
					<div class="mt-3"><Textarea name="body" rows={3} placeholder="Add detail (optional)…" /></div>
					<div class="mt-3 flex gap-2">
						<Button variant="primary" type="submit">Submit</Button>
						<Button variant="ghost" type="button" onclick={() => (showForm = false)}>Cancel</Button>
					</div>
				</form>
			{:else}
				<Button variant="primary" onclick={() => (showForm = true)}>Suggest something</Button>
			{/if}
		{:else}
			<div class="rounded-lg border border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">
				<a href="/auth/login" class="text-brand-600 hover:underline">Sign in</a> to suggest and comment.
				You can still upvote anonymously.
			</div>
		{/if}
	</div>

	<!-- Controls -->
	<div class="mb-4 flex items-center justify-between">
		<div class="flex gap-1">
			{#each sorts as s (s.key)}
				<button
					onclick={() => go({ sort: s.key })}
					class="rounded-md px-2.5 py-1 text-sm font-medium {data.sort === s.key ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}"
				>{s.label}</button>
			{/each}
		</div>
		<Select value={data.status} options={statusOptions} class="w-40" onchange={(v) => go({ status: v })} />
	</div>

	<!-- List -->
	<div class="space-y-2">
		{#each data.suggestions as s (s.id)}
			<div class="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700">
				<UpvoteButton subjectType="suggestion" id={s.id} count={s.votes} voted={s.voted} locked={!data.isMember && s.status !== 'open'} />
				<a href={`${base}/${s.id}`} class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="rounded-full px-2 py-0.5 text-[11px] font-medium" style={`background:${SUGGESTION_STATUS_META[s.status].color}22;color:${SUGGESTION_STATUS_META[s.status].color}`}>{SUGGESTION_STATUS_META[s.status].label}</span>
						<span class="font-medium">{s.title}</span>
					</div>
					{#if s.body}<p class="mt-1 line-clamp-2 text-sm text-neutral-500">{s.body}</p>{/if}
					<div class="mt-1.5 flex items-center gap-3 text-xs text-neutral-400">
						{#if s.authorName}<span>by {s.authorName}</span>{/if}
						{#if s.comments > 0}<span class="flex items-center gap-1"><MessageSquare size={12} /> {s.comments}</span>{/if}
					</div>
				</a>
			</div>
		{:else}
			<div class="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-400 dark:border-neutral-700">
				No suggestions yet. Be the first!
			</div>
		{/each}
	</div>
</main>
