<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Trash2, Check, GitBranch } from '@lucide/svelte';
	import { PALETTE } from '$lib/colors';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	const roleOptions = [
		{ value: 'maintainer', label: 'Maintainer' },
		{ value: 'collaborator', label: 'Collaborator' },
		{ value: 'viewer', label: 'Viewer' }
	];

	let color = $state<string>(data.project.color ?? PALETTE[6]);
	let icon = $state<string>(data.project.icon ?? '');
	let visibility = $state(data.project.visibility);
	let deleteOpen = $state(false);
	let selectedRepo = $state('');

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}
</script>

<svelte:head><title>Settings · {data.project.name}</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<header class="mb-8">
		<h1 class="text-xl font-semibold tracking-tight">Project settings</h1>
		<p class="mt-0.5 text-sm text-neutral-500">{data.project.name}</p>
	</header>

	<!-- General -->
	<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="mb-4 text-sm font-semibold">General</h2>
		<form method="POST" action="?/updateGeneral" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="flex flex-col gap-4">
			<div class="flex items-end gap-3">
				<div class="flex flex-col gap-1.5">
					<span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Icon</span>
					<div class="flex items-center gap-2">
						<div class="grid size-9 shrink-0 place-items-center rounded-lg text-base font-bold text-white" style={`background:${color}`}>
							{#if icon}{icon}{:else}{(data.project.name || 'P').slice(0, 1).toUpperCase()}{/if}
						</div>
						<Input name="icon" bind:value={icon} placeholder="🚀" class="w-16 text-center text-lg" maxlength={8} />
					</div>
				</div>
				<div class="flex-1"><Field label="Name"><Input name="name" value={data.project.name} required /></Field></div>
			</div>
			<Field label="Description">
				<Textarea name="description" rows={2} value={data.project.description ?? ''} />
			</Field>

			<Field label="Color">
				<input type="hidden" name="color" value={color} />
				<div class="flex flex-wrap gap-2">
					{#each PALETTE as c (c)}
						<button
							type="button"
							onclick={() => (color = c)}
							class="grid size-7 place-items-center rounded-full"
							class:ring-2={color === c}
							style={`background:${c}; --tw-ring-color:${c}`}
							aria-label={`Pick ${c}`}
						>{#if color === c}<Check size={14} class="text-white" />{/if}</button>
					{/each}
				</div>
			</Field>

			<Field label="Visibility" hint="Inherit uses the workspace's visibility.">
				<input type="hidden" name="visibility" value={visibility} />
				<div class="flex gap-2">
					{#each ['inherit', 'public', 'private'] as v (v)}
						<button
							type="button"
							onclick={() => (visibility = v as typeof visibility)}
							class={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${visibility === v ? 'border-brand-500 bg-brand-50/50 font-medium dark:bg-brand-500/10' : 'border-neutral-200 dark:border-neutral-800'}`}
						>{v}</button>
					{/each}
				</div>
			</Field>

			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" name="allowPublicComments" checked={data.project.allowPublicComments} class="size-4 rounded" />
				Allow logged-in public users to comment
			</label>

			<div class="flex items-center gap-3">
				<Button variant="primary" type="submit">Save changes</Button>
				{#if f?.saved}<span class="text-sm text-green-600">Saved</span>{/if}
				{#if f?.error}<span class="text-sm text-red-600">{f.error}</span>{/if}
			</div>
		</form>
	</section>

	<!-- Members -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="mb-4 text-sm font-semibold">Collaborators</h2>
		{#if data.members.length}
			<ul class="divide-y divide-neutral-100 dark:divide-neutral-800">
				{#each data.members as m (m.userId)}
					<li class="flex items-center gap-3 py-2.5">
						{#if m.avatarUrl}
							<img src={m.avatarUrl} alt="" class="size-7 rounded-full" />
						{:else}
							<div class="grid size-7 place-items-center rounded-full bg-neutral-200 text-xs font-medium dark:bg-neutral-700">
								{m.displayName.slice(0, 1).toUpperCase()}
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{m.displayName}</p>
							<p class="truncate text-xs text-neutral-500">@{m.username}</p>
						</div>
						<form method="POST" action="?/setRole" use:enhance>
							<input type="hidden" name="userId" value={m.userId} />
							<Select name="role" value={m.role} options={roleOptions} autosubmit class="w-36" />
						</form>
						<form method="POST" action="?/removeMember" use:enhance>
							<input type="hidden" name="userId" value={m.userId} />
							<button class="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Remove collaborator">
								<Trash2 size={15} />
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-sm text-neutral-500">No collaborators yet.</p>
		{/if}
	</section>

	<!-- Invite -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="mb-1 text-sm font-semibold">Invite collaborators</h2>
		<p class="mb-4 text-sm text-neutral-500">Generate a code that grants a role in this project.</p>
		<form method="POST" action="?/generateInvite" use:enhance class="flex flex-wrap items-end gap-3">
			<Field label="Role"><Select name="role" value="collaborator" options={roleOptions} /></Field>
			<Field label="Uses"><Input name="maxUses" type="number" min="1" value="1" class="w-20" /></Field>
			<Button variant="primary" type="submit">Generate</Button>
		</form>
		{#if f?.inviteLink}
			<div class="mt-4 flex items-center gap-2 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900">
				<code class="min-w-0 flex-1 truncate text-sm">{f.inviteLink}</code>
				<Button size="sm" variant="ghost" onclick={() => copy(f.inviteLink)}><Copy size={14} /> Copy</Button>
			</div>
		{/if}
	</section>

	<!-- GitHub -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><GitBranch size={15} /> GitHub sync</h2>
		<p class="mt-1 mb-4 text-sm text-neutral-500">
			Link a repository to sync issues and pull requests. GitHub is the source of truth on conflicts.
		</p>
		{#if !data.githubEnabled}
			<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
				The GitHub App isn't configured on this instance yet.
			</p>
		{:else if data.linkedRepo}
			<div class="flex items-center justify-between rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900">
				<span class="flex items-center gap-2 text-sm font-medium"><GitBranch size={14} /> {data.linkedRepo}</span>
				<form method="POST" action="?/unlinkRepo" use:enhance>
					<button class="text-xs text-neutral-400 hover:text-red-600">Unlink</button>
				</form>
			</div>
		{:else if data.repos.length}
			<form method="POST" action="?/linkRepo" use:enhance class="flex items-end gap-2">
				<div class="flex-1">
					<Select name="repo" bind:value={selectedRepo} options={data.repos} placeholder="Choose a repository…" />
				</div>
				<Button variant="primary" type="submit" disabled={!selectedRepo}>Link</Button>
			</form>
		{:else}
			<p class="text-sm text-neutral-500">
				No repositories available. Connect a GitHub account in
				<a href={`/w/${data.workspace.slug}/settings`} class="text-brand-600 hover:underline">workspace settings</a>, then it will show its repos here.
			</p>
		{/if}
	</section>

	<!-- Danger -->
	<section class="mt-6 rounded-xl border border-red-200 p-5 dark:border-red-900/50">
		<h2 class="text-sm font-semibold text-red-600">Danger zone</h2>
		<p class="mt-1 mb-3 text-sm text-neutral-500">
			Deleting a project removes its boards, tickets, and suggestions. This cannot be undone.
		</p>
		<Button variant="danger" onclick={() => (deleteOpen = true)}>
			<Trash2 size={15} /> Delete project
		</Button>
	</section>
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete project?"
	description="This permanently removes the project and all of its boards, tickets, and suggestions."
	confirmLabel="Delete project"
	action="?/deleteProject"
	requireText={data.project.name}
/>
