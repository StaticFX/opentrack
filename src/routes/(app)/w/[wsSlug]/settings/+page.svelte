<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Trash2, GitBranch, Plus, KeyRound } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	let deleteOpen = $state(false);

	const roleOptions = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'member', label: 'Member' },
		{ value: 'viewer', label: 'Viewer' }
	];

	let visibility = $state<'public' | 'private'>(data.workspace.visibility === 'private' ? 'private' : 'public');

	// Branding, kept in local state for the live preview.
	let name = $state(data.workspace.name);
	let icon = $state(data.workspace.icon ?? '');
	let color = $state(data.workspace.color ?? '');
	let avatarUrl = $state(data.workspace.avatarUrl ?? '');
	let publicHeadline = $state(data.workspace.publicHeadline ?? '');
	let publicTagline = $state(data.workspace.publicTagline ?? '');

	const swatches = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
	const previewLetter = $derived((name || 'W').slice(0, 1).toUpperCase());

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}
</script>

<svelte:head><title>Settings · {data.workspace.name}</title></svelte:head>

<div class="mx-auto max-w-2xl px-8 py-8">
	<header class="mb-8">
		<h1 class="text-xl font-semibold tracking-tight">Workspace settings</h1>
		<p class="mt-0.5 text-sm text-neutral-500">{data.workspace.name}</p>
	</header>

	<!-- General -->
	<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="mb-4 text-sm font-semibold">General</h2>
		<form method="POST" action="?/updateGeneral" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="flex flex-col gap-4">
			<!-- Branding preview -->
			<div class="flex items-center gap-4 rounded-lg border border-neutral-100 bg-neutral-50/60 p-4 dark:border-neutral-800/60 dark:bg-neutral-900/40">
				{#if avatarUrl}
					<img src={avatarUrl} alt="" class="size-12 shrink-0 rounded-lg object-cover" />
				{:else}
					<div class="grid size-12 shrink-0 place-items-center rounded-lg text-xl font-bold text-white" style={`background:${color || 'var(--color-brand-600)'}`}>
						{#if icon}{icon}{:else}{previewLetter}{/if}
					</div>
				{/if}
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold">{name || 'Workspace name'}</p>
					<p class="text-xs text-neutral-500">This is how your workspace appears in the sidebar.</p>
				</div>
			</div>

			<Field label="Name"><Input name="name" bind:value={name} required /></Field>
			<Field label="Description">
				<Textarea name="description" rows={2} value={data.workspace.description ?? ''} />
			</Field>

			<div class="flex flex-col gap-4 sm:flex-row">
				<Field label="Icon" hint="A single emoji.">
					<Input name="icon" bind:value={icon} placeholder="🚀" class="w-20 text-center text-lg" maxlength={8} />
				</Field>
				<div class="flex-1">
					<Field label="Accent color" hint="Used for the workspace badge.">
						<div class="flex items-center gap-2">
							<input type="hidden" name="color" value={color} />
							<div class="flex flex-wrap gap-1.5">
								{#each swatches as s (s)}
									<button
										type="button"
										onclick={() => (color = s)}
										aria-label={`Use ${s}`}
										class={`size-6 rounded-full ring-offset-1 ring-offset-white transition dark:ring-offset-neutral-950 ${color === s ? 'ring-2 ring-neutral-400' : ''}`}
										style={`background:${s}`}
									></button>
								{/each}
								<button
									type="button"
									onclick={() => (color = '')}
									aria-label="No accent color"
									class={`grid size-6 place-items-center rounded-full border border-neutral-300 text-[10px] text-neutral-400 dark:border-neutral-700 ${!color ? 'ring-2 ring-neutral-400' : ''}`}
								>✕</button>
							</div>
						</div>
					</Field>
				</div>
			</div>

			<Field label="Avatar image URL" hint="Overrides the icon and accent color.">
				<Input name="avatarUrl" bind:value={avatarUrl} type="url" placeholder="https://…" />
			</Field>

			<Field label="Visibility">
				<input type="hidden" name="visibility" value={visibility} />
				<div class="flex gap-2">
					{#each ['public', 'private'] as v (v)}
						<button
							type="button"
							onclick={() => (visibility = v as typeof visibility)}
							class={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${visibility === v ? 'border-brand-500 bg-brand-50/50 font-medium dark:bg-brand-500/10' : 'border-neutral-200 dark:border-neutral-800'}`}
						>{v}</button>
					{/each}
				</div>
			</Field>
			<div class="flex items-center gap-3">
				<Button variant="primary" type="submit">Save changes</Button>
				{#if f?.saved}<span class="text-sm text-green-600">Saved</span>{/if}
				{#if f?.error}<span class="text-sm text-red-600">{f.error}</span>{/if}
			</div>
		</form>
	</section>

	<!-- Public page -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<div class="mb-1 flex items-center justify-between">
			<h2 class="text-sm font-semibold">Public page</h2>
			<a href={`/${data.workspace.slug}`} target="_blank" rel="noreferrer" class="text-xs text-brand-600 hover:underline">View →</a>
		</div>
		<p class="mb-4 text-sm text-neutral-500">
			The hero shown on your workspace's public landing page. The header logo uses the icon &amp; color above.
		</p>
		<form method="POST" action="?/updatePublic" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="flex flex-col gap-4">
			<Field label="Headline" hint={`Defaults to the workspace name (“${data.workspace.name}”).`}>
				<Input name="publicHeadline" bind:value={publicHeadline} placeholder="Build in the open." />
			</Field>
			<Field label="Tagline" hint="Defaults to the workspace description.">
				<Textarea name="publicTagline" bind:value={publicTagline} rows={2} placeholder="Follow what's being worked on, upvote what matters, and suggest what comes next." />
			</Field>
			<!-- Preview -->
			<div class="rounded-lg border border-neutral-100 bg-neutral-50/60 p-4 dark:border-neutral-800/60 dark:bg-neutral-900/40">
				<p class="mb-2 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Preview</p>
				<p class="text-2xl font-bold tracking-tight">{publicHeadline.trim() || data.workspace.name}</p>
				<p class="mt-1 text-sm text-neutral-500">{publicTagline.trim() || data.workspace.description || "Follow what's being worked on, upvote what matters to you, and suggest what comes next."}</p>
			</div>
			<div class="flex items-center gap-3">
				<Button variant="primary" type="submit">Save public page</Button>
				{#if f?.savedPublic}<span class="text-sm text-green-600">Saved</span>{/if}
			</div>
		</form>
	</section>

	<!-- Members -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="mb-4 text-sm font-semibold">Members</h2>
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
					{#if m.userId === data.ownerId}
						<span class="text-xs font-medium text-neutral-500">Owner</span>
					{:else}
						<form method="POST" action="?/setRole" use:enhance>
							<input type="hidden" name="userId" value={m.userId} />
							<Select name="role" value={m.role} options={roleOptions} autosubmit class="w-32" />
						</form>
						<form method="POST" action="?/removeMember" use:enhance>
							<input type="hidden" name="userId" value={m.userId} />
							<button class="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Remove member">
								<Trash2 size={15} />
							</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<!-- Invite -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="mb-1 text-sm font-semibold">Invite collaborators</h2>
		<p class="mb-4 text-sm text-neutral-500">Generate a code that grants a role in this workspace.</p>
		<form method="POST" action="?/generateInvite" use:enhance class="flex flex-wrap items-end gap-3">
			<Field label="Role">
				<Select name="role" value="member" options={roleOptions} />
			</Field>
			<Field label="Uses">
				<Input name="maxUses" type="number" min="1" value="1" class="w-20" />
			</Field>
			<Button variant="primary" type="submit">Generate</Button>
		</form>
		{#if f?.inviteLink}
			<div class="mt-4 flex items-center gap-2 rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900">
				<code class="min-w-0 flex-1 truncate text-sm">{f.inviteLink}</code>
				<Button size="sm" variant="ghost" onclick={() => copy(f.inviteLink)}>
					<Copy size={14} /> Copy
				</Button>
			</div>
		{/if}
	</section>

	<!-- GitHub -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><GitBranch size={15} /> GitHub</h2>
		<p class="mt-1 mb-4 text-sm text-neutral-500">
			Connect a GitHub account or organization, then link its repositories to projects.
		</p>
		{#if !data.githubEnabled}
			<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
				The GitHub App isn't configured on this instance yet.{#if data.user.isAdmin}
					<a href="/admin" class="font-medium underline">Configure it in Admin →</a>{/if}
			</p>
		{:else}
			{#if data.installations.length}
				<ul class="mb-3 divide-y divide-neutral-100 dark:divide-neutral-800">
					{#each data.installations as inst (inst.id)}
						<li class="flex items-center justify-between py-2.5">
							<div class="flex items-center gap-2">
								<GitBranch size={15} class="text-neutral-400" />
								<span class="text-sm font-medium">{inst.accountLogin}</span>
								{#if inst.accountType}<span class="text-xs text-neutral-400">{inst.accountType}</span>{/if}
							</div>
							<form method="POST" action="?/disconnectGithub" use:enhance>
								<input type="hidden" name="installationId" value={inst.id} />
								<button class="text-xs text-neutral-400 hover:text-red-600">Disconnect</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<Button variant="default" href={`/w/${data.workspace.slug}/settings/github/connect`}>
				<Plus size={15} /> Connect GitHub account
			</Button>
		{/if}
	</section>

	<!-- API keys -->
	<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
		<h2 class="flex items-center gap-2 text-sm font-semibold"><KeyRound size={15} /> API keys</h2>
		<p class="mt-1 mb-4 text-sm text-neutral-500">
			Read-only access to this workspace's projects via the <code class="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">/api/v1</code> endpoints. Send the key as <code class="rounded bg-neutral-100 px-1 text-xs dark:bg-neutral-800">Authorization: Bearer &lt;key&gt;</code>.
		</p>

		{#if f?.apiKeyRaw}
			<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-950/30">
				<p class="mb-1 text-xs font-medium text-green-700 dark:text-green-300">Copy your key now — it won't be shown again.</p>
				<div class="flex items-center gap-2">
					<code class="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 font-mono text-xs dark:bg-neutral-900">{f.apiKeyRaw}</code>
					<button type="button" onclick={() => copy(f.apiKeyRaw)} class="shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Copy"><Copy size={14} /></button>
				</div>
			</div>
		{/if}

		{#if data.apiKeys.length}
			<div class="mb-3 divide-y divide-neutral-100 dark:divide-neutral-800">
				{#each data.apiKeys as k (k.id)}
					<div class="flex items-center gap-3 py-2">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium">{k.name}</p>
							<p class="text-xs text-neutral-400">{k.prefix}…· {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'never used'}</p>
						</div>
						<form method="POST" action="?/revokeApiKey" use:enhance>
							<input type="hidden" name="id" value={k.id} />
							<button class="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Revoke"><Trash2 size={14} /></button>
						</form>
					</div>
				{/each}
			</div>
		{/if}

		<form method="POST" action="?/createApiKey" use:enhance class="flex items-end gap-2">
			<div class="flex-1"><Field label="New key name"><Input name="name" placeholder="e.g. Docs website" /></Field></div>
			<Button variant="primary" type="submit"><Plus size={15} /> Create key</Button>
		</form>
	</section>

	<!-- Danger -->
	{#if data.isOwner}
		<section class="mt-6 rounded-xl border border-red-200 p-5 dark:border-red-900/50">
			<h2 class="text-sm font-semibold text-red-600">Danger zone</h2>
			<p class="mt-1 mb-3 text-sm text-neutral-500">
				Deleting a workspace removes all its projects, boards, and tickets. This cannot be undone.
			</p>
			<Button variant="danger" onclick={() => (deleteOpen = true)}>
				<Trash2 size={15} /> Delete workspace
			</Button>
		</section>
	{/if}
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete workspace?"
	description="This permanently removes the workspace and all of its projects, boards, and tickets."
	confirmLabel="Delete workspace"
	action="?/deleteWorkspace"
	requireText={data.workspace.name}
/>
