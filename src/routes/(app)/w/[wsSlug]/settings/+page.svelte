<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Copy, Trash2, GitBranch, Plus, KeyRound, Settings, Globe, Users, Plug, TriangleAlert } from '@lucide/svelte';
	import SettingsShell from '$lib/components/app/SettingsShell.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ConfirmPopover from '$lib/components/ui/ConfirmPopover.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import SaveBar from '$lib/components/ui/SaveBar.svelte';
	import { createDirtyGuard } from '$lib/dirty';
	import { toast } from '$lib/toast';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);
	let deleteOpen = $state(false);

	const roleOptions = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'member', label: 'Member' },
		{ value: 'viewer', label: 'Viewer' }
	];
	const roleLabel = (v: string) => roleOptions.find((o) => o.value === v)?.label ?? v;

	let visibility = $state<'public' | 'private'>(data.workspace.visibility === 'private' ? 'private' : 'public');

	// Branding, kept in local state for the live preview + dirty tracking.
	let name = $state(data.workspace.name);
	let description = $state(data.workspace.description ?? '');
	let icon = $state(data.workspace.icon ?? '');
	let color = $state(data.workspace.color ?? '');
	let avatarUrl = $state(data.workspace.avatarUrl ?? '');
	let publicHeadline = $state(data.workspace.publicHeadline ?? '');
	let publicTagline = $state(data.workspace.publicTagline ?? '');

	const swatches = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b'];
	const previewLetter = $derived((name || 'W').slice(0, 1).toUpperCase());

	const TAB_KEYS = ['general', 'public', 'members', 'integrations', 'apikeys', 'danger'] as const;
	type Tab = (typeof TAB_KEYS)[number];
	const items = $derived([
		{ label: 'General', icon: Settings, tab: 'general' },
		{ label: 'Public page', icon: Globe, tab: 'public' },
		{ label: 'Collaborators', icon: Users, tab: 'members' },
		{ label: 'Integrations', icon: Plug, tab: 'integrations' },
		{ label: 'API keys', icon: KeyRound, tab: 'apikeys' },
		...(data.isOwner ? [{ label: 'Danger', icon: TriangleAlert, tab: 'danger' }] : [])
	]);
	// The URL is the source of truth for the active tab (deep-linkable, survives refresh).
	const tab = $derived<Tab>(
		(TAB_KEYS as readonly string[]).includes(page.url.searchParams.get('tab') ?? '')
			? (page.url.searchParams.get('tab') as Tab)
			: 'general'
	);
	const base = $derived(`/w/${data.workspace.slug}`);
	// Every settings form folds the active tab into its action so a no-JS post
	// (or a JS one that fails and falls back) re-renders on the same tab.
	const actionFor = (name: string) => `?tab=${tab}&/${name}`;

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}

	// One page-level dirty guard: General and Public are the only edit-then-save
	// forms, and only one is ever mounted at a time (tab-gated), so a single
	// default key covers both correctly.
	const dirtyGuard = createDirtyGuard();
	const dirty = dirtyGuard.dirty;
	const pending = dirtyGuard.pending;
	let savingGeneral = $state(false);
	let savingPublic = $state(false);

	function discardGeneral() {
		name = data.workspace.name;
		description = data.workspace.description ?? '';
		icon = data.workspace.icon ?? '';
		color = data.workspace.color ?? '';
		avatarUrl = data.workspace.avatarUrl ?? '';
		visibility = data.workspace.visibility === 'private' ? 'private' : 'public';
		dirtyGuard.markClean();
	}
	function discardPublic() {
		publicHeadline = data.workspace.publicHeadline ?? '';
		publicTagline = data.workspace.publicTagline ?? '';
		dirtyGuard.markClean();
	}

	// General and Public are the only two actions with tab-unique flags; the
	// rest (setRole/removeMember/disconnectGithub) share `{saved:true}` with
	// General, so their feedback fires at the point of confirmation instead
	// (see askConfirm/confirmYes below) rather than off the ambiguous flag.
	$effect(() => {
		if (f?.saved && tab === 'general') {
			dirtyGuard.markClean();
			toast('Workspace saved.', { tone: 'success' });
		} else if (f?.savedPublic) {
			dirtyGuard.markClean();
			toast('Public page saved.', { tone: 'success' });
		}
	});

	// Destruction Tier 2 (member remove, API key revoke, GitHub disconnect) —
	// the real per-row form carries the id; the button just gates submission
	// behind a styled confirm dialog. No-JS still works (real submit button).
	let confirmOpen = $state(false);
	let confirmButton = $state<HTMLButtonElement | null>(null);
	let confirmTitle = $state('');
	let confirmDesc = $state('');
	let confirmSuccessMsg = $state('');
	function askConfirm(e: MouseEvent, title: string, desc: string, successMsg: string) {
		e.preventDefault();
		confirmButton = e.currentTarget as HTMLButtonElement;
		confirmTitle = title;
		confirmDesc = desc;
		confirmSuccessMsg = successMsg;
		confirmOpen = true;
	}
	function confirmYes() {
		confirmOpen = false;
		confirmButton?.form?.requestSubmit(confirmButton);
		toast(confirmSuccessMsg, { tone: 'success' });
	}
</script>

<svelte:head><title>Settings · {data.workspace.name}</title></svelte:head>

<SettingsShell
	scope="workspace"
	{items}
	active={tab}
	backHref={base}
	backLabel="Back to workspace"
	title={data.workspace.name}
	color={data.workspace.color}
	icon={data.workspace.icon}
	avatarUrl={data.workspace.avatarUrl}
>
	{#if tab === 'general'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">General</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Identity, branding, and visibility.</p>
		</header>
		<section class="border-t border-[var(--rule)] pt-5">
			<form
				method="POST"
				action={actionFor('updateGeneral')}
				use:enhance={() => async ({ update }) => {
					savingGeneral = true;
					await update({ reset: false });
					savingGeneral = false;
				}}
				oninput={() => dirtyGuard.markDirty()}
				class="flex flex-col gap-4"
			>
				<!-- Branding preview -->
				<div class="flex items-center gap-4 border border-[var(--rule)] p-4">
					{#if avatarUrl}
						<img src={avatarUrl} alt="" class="size-12 shrink-0 rounded-[3px] object-cover" />
					{:else}
						<div class="grid size-12 shrink-0 place-items-center rounded-[3px] text-xl font-bold text-white" style={`background:${color || 'var(--color-brand-600)'}`}>
							{#if icon}{icon}{:else}{previewLetter}{/if}
						</div>
					{/if}
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-[var(--text)]">{name || 'Workspace name'}</p>
						<p class="text-[12px] text-[var(--faint)]">This is how your workspace appears in the sidebar.</p>
					</div>
				</div>

				<Field label="Name"><Input name="name" bind:value={name} required /></Field>
				<Field label="Description">
					<Textarea name="description" rows={2} bind:value={description} />
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
											onclick={() => { color = s; dirtyGuard.markDirty(); }}
											aria-label={`Use ${s}`}
											class={`focus-ring size-6 rounded-full ring-offset-2 ring-offset-[var(--ground)] transition ${color === s ? 'ring-2 ring-[var(--text)]' : ''}`}
											style={`background:${s}`}
										></button>
									{/each}
									<button
										type="button"
										onclick={() => { color = ''; dirtyGuard.markDirty(); }}
										aria-label="No accent color"
										class={`focus-ring grid size-6 place-items-center rounded-full border border-[var(--rule)] text-[10px] text-[var(--faint)] ${!color ? 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--ground)]' : ''}`}
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
								onclick={() => { visibility = v as typeof visibility; dirtyGuard.markDirty(); }}
								class={`focus-ring flex-1 rounded-[3px] border px-3 py-2 text-[13px] capitalize transition-colors ${visibility === v ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] font-medium text-[var(--text)]' : 'border-[var(--rule)] text-[var(--dim)]'}`}
							>{v}</button>
						{/each}
					</div>
				</Field>
				<div class="flex items-center gap-3">
					<Button variant="primary" type="submit">Save changes</Button>
					{#if f?.error}<span class="text-[13px] text-[#f85149]">{f.error}</span>{/if}
				</div>
				<SaveBar dirty={$dirty} saving={savingGeneral} onDiscard={discardGeneral} />
			</form>
		</section>
	{:else if tab === 'public'}
		<header class="mb-1 flex items-center justify-between">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Public page</h2>
			<a href={`/${data.workspace.slug}`} target="_blank" rel="noreferrer" class="mono-focus text-[12px] text-[var(--accent)] hover:underline">View →</a>
		</header>
		<p class="mb-5 text-[13px] text-[var(--dim)]">
			The hero shown on your workspace's public landing page. The header logo uses the icon &amp; color from General.
		</p>
		<section class="border-t border-[var(--rule)] pt-5">
			<form
				method="POST"
				action={actionFor('updatePublic')}
				use:enhance={() => async ({ update }) => {
					savingPublic = true;
					await update({ reset: false });
					savingPublic = false;
				}}
				oninput={() => dirtyGuard.markDirty()}
				class="flex flex-col gap-4"
			>
				<Field label="Headline" hint={`Defaults to the workspace name (“${data.workspace.name}”).`}>
					<Input name="publicHeadline" bind:value={publicHeadline} placeholder="Build in the open." />
				</Field>
				<Field label="Tagline" hint="Defaults to the workspace description.">
					<Textarea name="publicTagline" bind:value={publicTagline} rows={2} placeholder="Follow what's being worked on, upvote what matters, and suggest what comes next." />
				</Field>
				<!-- Preview -->
				<div class="border border-[var(--rule)] p-4">
					<p class="mb-2 text-[10px] font-medium tracking-[0.18em] text-[var(--faint)] uppercase">// Preview</p>
					<p class="mono-display text-2xl tracking-tight text-[var(--text)]">{publicHeadline.trim() || data.workspace.name}</p>
					<p class="mt-1 text-[13px] text-[var(--dim)]">{publicTagline.trim() || data.workspace.description || "Follow what's being worked on, upvote what matters to you, and suggest what comes next."}</p>
				</div>
				<div>
					<Button variant="primary" type="submit">Save public page</Button>
				</div>
				<SaveBar dirty={$dirty} saving={savingPublic} onDiscard={discardPublic} />
			</form>
		</section>
	{:else if tab === 'members'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Collaborators</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Who can access this workspace, and what they can do.</p>
		</header>
		<section class="border-t border-[var(--rule)] pt-1">
			{#if data.members.length}
				<ul class="border-t border-[var(--rule)]">
					{#each data.members as m (m.userId)}
						<li class="flex items-center gap-3 border-b border-[var(--rule)] py-2.5">
							{#if m.avatarUrl}
								<img src={m.avatarUrl} alt="" class="size-7 rounded-full" />
							{:else}
								<div class="grid size-7 place-items-center rounded-full border border-[var(--rule)] bg-[var(--raised)] text-[11px] font-medium text-[var(--dim)]">
									{m.displayName.slice(0, 1).toUpperCase()}
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-[13px] font-medium text-[var(--text)]">{m.displayName}</p>
								<p class="data-mono truncate text-[var(--faint)]">@{m.username}</p>
							</div>
							{#if m.userId === data.ownerId}
								<span class="text-[12px] font-medium text-[var(--faint)]">Owner</span>
							{:else}
								<form method="POST" action={actionFor('setRole')} use:enhance>
									<input type="hidden" name="userId" value={m.userId} />
									<Select name="role" value={m.role} options={roleOptions} autosubmit class="w-32" />
								</form>
								<form method="POST" action={actionFor('removeMember')} use:enhance>
									<input type="hidden" name="userId" value={m.userId} />
									<button
										type="submit"
										onclick={(e) => askConfirm(e, 'Remove member?', `${m.displayName} will lose access to this workspace immediately.`, 'Member removed.')}
										class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]"
										aria-label="Remove member"
									>
										<Trash2 size={15} />
									</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-[13px] text-[var(--faint)]">No collaborators yet.</p>
			{/if}
		</section>

		<section class="mt-8 border-t border-[var(--rule)] pt-5">
			<p class="mb-1 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Invite collaborators</p>
			<p class="mb-4 text-[13px] text-[var(--dim)]">Generate a code that grants a role in this workspace.</p>
			<form method="POST" action={actionFor('generateInvite')} use:enhance class="flex flex-wrap items-end gap-3">
				<Field label="Role">
					<Select name="role" value="member" options={roleOptions} />
				</Field>
				<Field label="Uses">
					<Input name="maxUses" type="number" min="1" value="1" class="w-20" />
				</Field>
				<Button variant="primary" type="submit">Generate</Button>
			</form>
			{#if f?.inviteLink}
				<div class="mt-4 flex items-center gap-2 border border-[var(--rule)] bg-[var(--raised)] p-3">
					<code class="data-mono min-w-0 flex-1 truncate text-[13px] text-[var(--text)]">{f.inviteLink}</code>
					<Button size="sm" variant="ghost" onclick={() => copy(f.inviteLink)}>
						<Copy size={14} /> Copy
					</Button>
				</div>
			{/if}

			{#if data.invites.length}
				<div class="mt-5 border-t border-[var(--rule)] pt-4">
					<p class="mb-2 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Active invite codes</p>
					<ul class="border-t border-[var(--rule)]">
						{#each data.invites as inv (inv.id)}
							<li class="flex items-center gap-3 border-b border-[var(--rule)] py-2 text-[13px]">
								<Badge>{roleLabel(inv.roleGrant)}</Badge>
								<span class="min-w-0 flex-1 truncate text-[var(--dim)]">
									{inv.uses}/{inv.maxUses} used{#if inv.note} · {inv.note}{/if}
								</span>
								<form method="POST" action={actionFor('deleteInvite')} use:enhance id={`delete-invite-${inv.id}`}>
									<input type="hidden" name="id" value={inv.id} />
								</form>
								<ConfirmPopover
									message="Delete this invite code? It can't be undone."
									onconfirm={() => (document.getElementById(`delete-invite-${inv.id}`) as HTMLFormElement | null)?.requestSubmit()}
								>
									{#snippet trigger(props)}
										<button
											type="submit"
											form={`delete-invite-${inv.id}`}
											{...props}
											onclick={(e) => { e.preventDefault(); props.onclick(); }}
											class="rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]"
											aria-label="Delete invite"
										><Trash2 size={14} /></button>
									{/snippet}
								</ConfirmPopover>
							</li>
						{/each}
					</ul>
					<p class="mt-2 text-[11px] text-[var(--faint)]">Codes can't be shown again after they're generated — delete and regenerate if one leaks.</p>
				</div>
			{/if}
		</section>
	{:else if tab === 'integrations'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Integrations</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Connect a GitHub account or organization, then link its repositories to projects.</p>
		</header>
		<section class="border-t border-[var(--rule)] pt-5">
			<h3 class="flex items-center gap-2 text-[13px] font-medium text-[var(--text)]"><GitBranch size={15} class="text-[var(--faint)]" /> GitHub</h3>
			<p class="mt-1 mb-4 text-[13px] text-[var(--dim)]">
				Link repositories to projects and keep tickets in sync with issues.
			</p>
			{#if !data.githubEnabled}
				<p class="border border-[color-mix(in_srgb,var(--amber)_35%,transparent)] bg-[color-mix(in_srgb,var(--amber)_10%,transparent)] p-3 text-[13px] text-[var(--amber)]">
					The GitHub App isn't configured on this instance yet.{#if data.user.isAdmin}
						<a href="/admin" class="mono-focus font-medium underline">Configure it in Admin →</a>{/if}
				</p>
			{:else}
				{#if data.installations.length}
					<ul class="mb-3 border-t border-[var(--rule)]">
						{#each data.installations as inst (inst.id)}
							<li class="flex items-center justify-between border-b border-[var(--rule)] py-2.5">
								<div class="flex items-center gap-2">
									<GitBranch size={15} class="text-[var(--faint)]" />
									<span class="text-[13px] font-medium text-[var(--text)]">{inst.accountLogin}</span>
									{#if inst.accountType}<span class="text-[11px] text-[var(--faint)]">{inst.accountType}</span>{/if}
								</div>
								<form method="POST" action={actionFor('disconnectGithub')} use:enhance>
									<input type="hidden" name="installationId" value={inst.id} />
									<button
										type="submit"
										onclick={(e) => askConfirm(e, 'Disconnect GitHub?', `${inst.accountLogin} will stop syncing with this workspace.`, 'GitHub disconnected.')}
										class="mono-focus text-[12px] text-[var(--faint)] transition-colors hover:text-[#f85149]"
									>Disconnect</button>
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
	{:else if tab === 'apikeys'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">API keys</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">
				Programmatic access to this workspace via the <code class="rounded-[3px] bg-[var(--raised)] px-1 text-[11px] text-[var(--dim)]">/api/v1</code> endpoints and the <code class="rounded-[3px] bg-[var(--raised)] px-1 text-[11px] text-[var(--dim)]">/api/mcp</code> server. Send the key as <code class="rounded-[3px] bg-[var(--raised)] px-1 text-[11px] text-[var(--dim)]">Authorization: Bearer &lt;key&gt;</code>. Grant only the scopes it needs.
			</p>
		</header>
		<section class="border-t border-[var(--rule)] pt-5">
			{#if f?.apiKeyRaw}
				<div class="mb-4 border border-[color-mix(in_srgb,var(--green)_35%,transparent)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)] p-3">
					<p class="mb-1 text-[11px] font-medium text-[var(--green)]">Copy your key now — it won't be shown again.</p>
					<div class="flex items-center gap-2">
						<code class="data-mono min-w-0 flex-1 truncate bg-[var(--raised)] px-2 py-1.5 text-[12px] text-[var(--text)]">{f.apiKeyRaw}</code>
						<button type="button" onclick={() => copy(f.apiKeyRaw)} class="mono-focus shrink-0 rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)] hover:text-[var(--text)]" aria-label="Copy"><Copy size={14} /></button>
					</div>
				</div>
			{/if}

			{#if data.apiKeys.length}
				<div class="mb-3 border-t border-[var(--rule)]">
					{#each data.apiKeys as k (k.id)}
						<div class="flex items-center gap-3 border-b border-[var(--rule)] py-2">
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-1.5">
									<p class="truncate text-[13px] font-medium text-[var(--text)]">{k.name}</p>
									{#each k.scopes as sc (sc)}<Badge>{sc}</Badge>{/each}
								</div>
								<p class="text-[11px] text-[var(--faint)]"><span class="data-mono">{k.prefix}…</span>· {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'never used'}</p>
							</div>
							<form method="POST" action={actionFor('revokeApiKey')} use:enhance>
								<input type="hidden" name="id" value={k.id} />
								<button
									type="submit"
									onclick={(e) => askConfirm(e, 'Revoke API key?', `Clients using “${k.name}” will stop working immediately.`, 'API key revoked.')}
									class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]"
									aria-label="Revoke"
								><Trash2 size={14} /></button>
							</form>
						</div>
					{/each}
				</div>
			{/if}

			<form method="POST" action={actionFor('createApiKey')} use:enhance class="flex flex-col gap-3">
				<div class="flex items-end gap-2">
					<div class="flex-1"><Field label="New key name"><Input name="name" placeholder="e.g. Docs website" /></Field></div>
					<Button variant="primary" type="submit"><Plus size={15} /> Create key</Button>
				</div>
				<div class="flex flex-wrap gap-4">
					<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="scope" value="read" checked class="size-4 accent-[var(--accent)]" /> Read <span class="text-[11px] text-[var(--faint)]">— list/read + search</span></label>
					<label class="flex items-center gap-2 text-[13px] text-[var(--text)]"><input type="checkbox" name="scope" value="write" class="size-4 accent-[var(--accent)]" /> Write <span class="text-[11px] text-[var(--faint)]">— create/update/comment (MCP)</span></label>
				</div>
			</form>
		</section>
	{:else if tab === 'danger'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Danger zone</h2>
		</header>
		<section class="border-t border-[color-mix(in_srgb,#f85149_35%,transparent)] pt-5">
			<h3 class="text-[13px] font-medium text-[#f85149]">Delete workspace</h3>
			<p class="mt-1 mb-3 text-[13px] text-[var(--dim)]">
				Deleting a workspace removes all its projects, boards, and tickets. This cannot be undone.
			</p>
			<Button variant="danger" onclick={() => (deleteOpen = true)}>
				<Trash2 size={15} /> Delete workspace
			</Button>
		</section>
	{/if}
</SettingsShell>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete workspace?"
	description="This permanently removes the workspace and all of its projects, boards, and tickets."
	confirmLabel="Delete workspace"
	action={actionFor('deleteWorkspace')}
	requireText={data.workspace.name}
/>

<Dialog bind:open={confirmOpen} title={confirmTitle} description={confirmDesc}>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button variant="danger" type="button" onclick={confirmYes}>Confirm</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={() => $pending, (v) => { if (!v) dirtyGuard.stay(); }}
	title="Discard changes?"
	description="You have unsaved edits on this tab. Leaving now will discard them."
>
	{#snippet footer()}
		<Button variant="ghost" type="button" onclick={() => dirtyGuard.stay()}>Keep editing</Button>
		<Button variant="danger" type="button" onclick={() => dirtyGuard.discard()}>Discard</Button>
	{/snippet}
</Dialog>
