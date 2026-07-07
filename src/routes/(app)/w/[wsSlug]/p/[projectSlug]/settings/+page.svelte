<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Trash2, Check, GitBranch, Settings, Users, TriangleAlert, ArrowLeft, MessageSquare, Send, SlidersHorizontal, Plus, Zap, ArrowRight } from '@lucide/svelte';
	import { PALETTE } from '$lib/colors';
	import { PRIORITIES } from '$lib/constants';
	import { PRIORITY_META } from '$lib/priority';
	import { DISCORD_EVENTS } from '$lib/discord';
	import { CUSTOM_FIELD_TYPES, FIELD_TYPE_LABELS } from '$lib/customFields';
	import { WORKFLOW_TRIGGERS, WORKFLOW_ACTIONS, WORKFLOW_CONDITIONS } from '$lib/workflow';
	import { cn } from '$lib/utils/cn';
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

	const tabs = [
		{ id: 'general', label: 'General', icon: Settings },
		{ id: 'members', label: 'Collaborators', icon: Users },
		{ id: 'github', label: 'GitHub', icon: GitBranch },
		{ id: 'discord', label: 'Discord', icon: MessageSquare },
		{ id: 'fields', label: 'Fields', icon: SlidersHorizontal },
		{ id: 'automation', label: 'Automation', icon: Zap },
		{ id: 'danger', label: 'Danger', icon: TriangleAlert }
	] as const;

	// ── Automation rules (client-managed via the API) ────────────────────────
	type Cond = { type: string; value: string };
	type Act = { type: string; config: Record<string, unknown> };
	let rules = $state(data.rules);
	const columnNames = $derived([...new Set(data.columns.map((c) => c.name))]);
	const priorityOpts = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }));
	const labelOpts = $derived(data.labels.map((l) => ({ value: l.id, label: l.name })));
	const memberOpts = $derived(data.members.map((m: any) => ({ value: m.userId, label: m.displayName })));
	const columnOpts = $derived(columnNames.map((n) => ({ value: n, label: n })));

	// New-rule builder state.
	let rName = $state('');
	let rTrigger = $state('ticket.created');
	let rTriggerColumn = $state('');
	let rTriggerLabel = $state('');
	let rTriggerDays = $state(14);
	let rConds = $state<Cond[]>([]);
	let rActs = $state<Act[]>([{ type: 'add_label', config: {} }]);
	let ruleErr = $state('');
	const triggerDef = $derived(WORKFLOW_TRIGGERS.find((t) => t.type === rTrigger));

	const labelName = (id: string) => data.labels.find((l) => l.id === id)?.name ?? id;
	const memberName = (id: string) => (data.members as any[]).find((m) => m.userId === id)?.displayName ?? id;
	const trigLabel = (t?: string) => WORKFLOW_TRIGGERS.find((x) => x.type === t)?.label ?? t ?? '';
	const actLabel = (a: string) => WORKFLOW_ACTIONS.find((x) => x.type === a)?.label ?? a;

	function summariseAction(a: Act): string {
		const c = a.config ?? {};
		if (a.type === 'add_label') return `Add label “${labelName(String(c.labelId ?? ''))}”`;
		if (a.type === 'assign') return `Assign ${memberName(String(c.userId ?? ''))}`;
		if (a.type === 'set_priority') return `Set priority ${c.priority}`;
		if (a.type === 'move_to_column') return `Move to “${c.columnName}”`;
		if (a.type === 'post_comment') return `Comment`;
		if (a.type === 'notify_watchers') return `Notify watchers`;
		if (a.type === 'close') return `Close ticket`;
		return a.type;
	}

	function addAction() {
		rActs = [...rActs, { type: 'add_label', config: {} }];
	}
	function addCond() {
		rConds = [...rConds, { type: 'priority', value: '' }];
	}
	function buildTriggerConfig(): Record<string, unknown> {
		if (rTrigger === 'ticket.moved') return { columnName: rTriggerColumn };
		if (rTrigger === 'ticket.labeled') return { labelId: rTriggerLabel };
		if (rTrigger === 'ticket.stale') return { days: rTriggerDays };
		return {};
	}
	async function createRule() {
		ruleErr = '';
		if (!rName.trim()) { ruleErr = 'Name is required'; return; }
		if (!rActs.length) { ruleErr = 'Add at least one action'; return; }
		const body = {
			name: rName.trim(),
			trigger: { type: rTrigger, config: buildTriggerConfig() },
			conditions: rConds.filter((c) => c.value),
			actions: rActs
		};
		const res = await fetch(`/api/projects/${data.project.id}/workflow-rules`, {
			method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
		});
		if (!res.ok) { ruleErr = (await res.json().catch(() => ({}))).message ?? 'Could not save'; return; }
		rules = [...rules, (await res.json()).rule];
		rName = ''; rConds = []; rActs = [{ type: 'add_label', config: {} }];
	}
	async function toggleRule(r: any) {
		r.enabled = !r.enabled;
		rules = rules;
		await fetch(`/api/workflow-rules/${r.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: r.enabled }) });
	}
	async function deleteRule(id: string) {
		rules = rules.filter((r) => r.id !== id);
		await fetch(`/api/workflow-rules/${id}`, { method: 'DELETE' });
	}

	// ── Custom fields (client-managed via the API) ───────────────────────────
	let localFields = $state(data.fields);
	let fName = $state('');
	let fType = $state<string>('text');
	let fOptions = $state('');
	async function refreshFields() {
		const res = await fetch(`/api/projects/${data.project.id}/fields`);
		if (res.ok) localFields = (await res.json()).fields;
	}
	async function addField() {
		const name = fName.trim();
		if (!name) return;
		const options = fType === 'select' ? fOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
		if (fType === 'select' && !options?.length) return;
		const res = await fetch(`/api/projects/${data.project.id}/fields`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, type: fType, options })
		});
		if (res.ok) { fName = ''; fOptions = ''; fType = 'text'; await refreshFields(); }
	}
	async function removeField(id: string) {
		localFields = localFields.filter((f) => f.id !== id);
		await fetch(`/api/fields/${id}`, { method: 'DELETE' });
	}
	let tab = $state<(typeof tabs)[number]['id']>('general');
	const base = $derived(`/w/${data.workspace.slug}/p/${data.project.slug}`);

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}
</script>

<svelte:head><title>Settings · {data.project.name}</title></svelte:head>

<div class="flex h-screen min-w-0">
	<!-- Settings nav (secondary sidebar) -->
	<aside class="flex h-screen w-56 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/40">
		<div class="p-2">
			<a href={base} class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-800">
				<ArrowLeft size={15} /> Back to project
			</a>
		</div>
		<div class="px-4 pt-3 pb-1">
			<h1 class="text-sm font-semibold tracking-tight">Project settings</h1>
			<p class="truncate text-xs text-neutral-500">{data.project.name}</p>
		</div>
		<nav class="flex-1 overflow-y-auto px-2 py-2">
			{#each tabs as t (t.id)}
				<button
					type="button"
					onclick={() => (tab = t.id)}
					class={cn(
						'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
						tab === t.id
							? 'bg-neutral-200/70 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
							: t.id === 'danger'
								? 'text-red-600/80 hover:bg-red-50 dark:hover:bg-red-950/30'
								: 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
					)}
				>
					<t.icon size={15} class={t.id === 'danger' ? 'text-red-500' : 'text-neutral-400'} />
					{t.label}
				</button>
			{/each}
		</nav>
	</aside>

	<!-- Content -->
	<div class="min-w-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-2xl px-8 py-8">
			{#if tab === 'general'}
				<h2 class="mb-4 text-lg font-semibold tracking-tight">General</h2>
				<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
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
									<button type="button" onclick={() => (color = c)} class="grid size-7 place-items-center rounded-full" class:ring-2={color === c} style={`background:${c}; --tw-ring-color:${c}`} aria-label={`Pick ${c}`}>{#if color === c}<Check size={14} class="text-white" />{/if}</button>
								{/each}
							</div>
						</Field>

						<Field label="Visibility" hint="Inherit uses the workspace's visibility.">
							<input type="hidden" name="visibility" value={visibility} />
							<div class="flex gap-2">
								{#each ['inherit', 'public', 'private'] as v (v)}
									<button type="button" onclick={() => (visibility = v as typeof visibility)} class={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize transition ${visibility === v ? 'border-brand-500 bg-brand-50/50 font-medium dark:bg-brand-500/10' : 'border-neutral-200 dark:border-neutral-800'}`}>{v}</button>
								{/each}
							</div>
						</Field>

						<label class="flex items-center gap-2 text-sm">
							<input type="checkbox" name="allowPublicComments" checked={data.project.allowPublicComments} class="size-4 rounded accent-brand-600" />
							Allow logged-in public users to comment
						</label>

						<div class="flex items-center gap-3">
							<Button variant="primary" type="submit">Save changes</Button>
							{#if f?.saved}<span class="text-sm text-green-600">Saved</span>{/if}
							{#if f?.error}<span class="text-sm text-red-600">{f.error}</span>{/if}
						</div>
					</form>
				</section>

				{#if data.isPublic}
					<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
						<h3 class="text-sm font-semibold">Embed</h3>
						<p class="mt-1 mb-3 text-sm text-neutral-500">Drop your roadmap or changelog into any website with an iframe.</p>
						{#each [{ label: 'Roadmap', path: 'roadmap', h: 340 }, { label: 'Changelog', path: 'changelog', h: 320 }] as em (em.path)}
							{@const snippet = `<iframe src="${data.origin}/embed/${data.workspace.slug}/${data.project.slug}/${em.path}" width="100%" height="${em.h}" style="border:1px solid #e5e7eb;border-radius:12px" title="${data.project.name} ${em.label}"></iframe>`}
							<div class="mb-3">
								<div class="mb-1 flex items-center justify-between">
									<span class="text-xs font-medium text-neutral-500">{em.label}</span>
									<div class="flex items-center gap-2">
										<a href={`${data.origin}/embed/${data.workspace.slug}/${data.project.slug}/${em.path}`} target="_blank" rel="noreferrer" class="text-xs text-brand-600 hover:underline">Preview</a>
										<button type="button" onclick={() => copy(snippet)} class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"><Copy size={12} /> Copy</button>
									</div>
								</div>
								<code class="block overflow-x-auto rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-[11px] whitespace-pre text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400">{snippet}</code>
							</div>
						{/each}

						<div class="mt-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
							<p class="mb-2 text-xs text-neutral-500">GitHub READMEs can’t embed iframes — use the SVG image instead. This <code class="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">&lt;picture&gt;</code> auto-switches with the reader’s light/dark theme:</p>
							{#each [{ label: 'Roadmap', img: 'roadmap.svg', link: 'roadmap' }, { label: 'Changelog', img: 'changelog.svg', link: 'releases' }] as em (em.img)}
								{@const base = `${data.origin}/embed/${data.workspace.slug}/${data.project.slug}/${em.img}`}
								{@const md = `<a href="${data.origin}/${data.workspace.slug}/${data.project.slug}/${em.link}">\n  <picture>\n    <source media="(prefers-color-scheme: dark)" srcset="${base}?theme=dark">\n    <img alt="${data.project.name} ${em.label}" src="${base}">\n  </picture>\n</a>`}
								<div class="mb-3">
									<div class="mb-1 flex items-center justify-between">
										<span class="text-xs font-medium text-neutral-500">{em.label} · Markdown / HTML (auto dark mode)</span>
										<div class="flex items-center gap-2">
											<a href={base} target="_blank" rel="noreferrer" class="text-xs text-brand-600 hover:underline">Light</a>
											<a href={`${base}?theme=dark`} target="_blank" rel="noreferrer" class="text-xs text-brand-600 hover:underline">Dark</a>
											<button type="button" onclick={() => copy(md)} class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"><Copy size={12} /> Copy</button>
										</div>
									</div>
									<code class="block overflow-x-auto rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-[11px] whitespace-pre text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400">{md}</code>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			{:else if tab === 'members'}
				<h2 class="mb-4 text-lg font-semibold tracking-tight">Collaborators</h2>
				<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
					{#if data.members.length}
						<ul class="divide-y divide-neutral-100 dark:divide-neutral-800">
							{#each data.members as m (m.userId)}
								<li class="flex items-center gap-3 py-2.5">
									{#if m.avatarUrl}
										<img src={m.avatarUrl} alt="" class="size-7 rounded-full" />
									{:else}
										<div class="grid size-7 place-items-center rounded-full bg-neutral-200 text-xs font-medium dark:bg-neutral-700">{m.displayName.slice(0, 1).toUpperCase()}</div>
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
										<button class="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Remove collaborator"><Trash2 size={15} /></button>
									</form>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="text-sm text-neutral-500">No collaborators yet.</p>
					{/if}
				</section>

				<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
					<h3 class="mb-1 text-sm font-semibold">Invite collaborators</h3>
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
			{:else if tab === 'github'}
				<h2 class="mb-4 text-lg font-semibold tracking-tight">GitHub</h2>
				<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
					<h3 class="flex items-center gap-2 text-sm font-semibold"><GitBranch size={15} /> Linked repository</h3>
					<p class="mt-1 mb-4 text-sm text-neutral-500">Sync issues and pull requests. GitHub is the source of truth on conflicts.</p>
					{#if !data.githubEnabled}
						<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">The GitHub App isn't configured on this instance yet.</p>
					{:else if data.linkedRepo}
						<div class="flex items-center justify-between rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900">
							<a href={`https://github.com/${data.linkedRepo}`} target="_blank" rel="noreferrer" class="flex items-center gap-2 text-sm font-medium hover:underline"><GitBranch size={14} /> {data.linkedRepo}</a>
							<form method="POST" action="?/unlinkRepo" use:enhance>
								<button class="text-xs text-neutral-400 hover:text-red-600">Unlink</button>
							</form>
						</div>
					{:else if data.repos.length}
						<form method="POST" action="?/linkRepo" use:enhance class="flex items-end gap-2">
							<div class="flex-1"><Select name="repo" bind:value={selectedRepo} options={data.repos} placeholder="Choose a repository…" /></div>
							<Button variant="primary" type="submit" disabled={!selectedRepo}>Link</Button>
						</form>
					{:else}
						<p class="text-sm text-neutral-500">No repositories available. Connect a GitHub account in <a href={`/w/${data.workspace.slug}/settings`} class="text-brand-600 hover:underline">workspace settings</a>.</p>
					{/if}
				</section>

				{#if data.linkedRepo}
					<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
						<h3 class="text-sm font-semibold">Sync options</h3>
						<p class="mt-1 mb-3 text-sm text-neutral-500">Choose which issue facets sync between OpenTrack and GitHub.</p>
						<form method="POST" action="?/saveGithubSync" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="flex flex-col gap-3">
							<div class="space-y-1.5">
								<label class="flex items-center gap-2 text-sm">
									<input type="checkbox" name="syncAssignees" checked={data.githubSync.assignees} class="size-4 accent-brand-600" />
									Assignees <span class="text-xs text-neutral-400">— map GitHub assignees to linked accounts (and back)</span>
								</label>
								<label class="flex items-center gap-2 text-sm">
									<input type="checkbox" name="syncLabels" checked={data.githubSync.labels} class="size-4 accent-brand-600" />
									Labels <span class="text-xs text-neutral-400">— mirror issue labels onto tickets</span>
								</label>
								<label class="flex items-center gap-2 text-sm">
									<input type="checkbox" name="syncPriority" checked={data.githubSync.priority} class="size-4 accent-brand-600" />
									Priority <span class="text-xs text-neutral-400">— mirror priority as a <code class="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">priority: …</code> label</span>
								</label>
								<label class="flex items-center gap-2 text-sm">
									<input type="checkbox" name="syncMilestones" checked={data.githubSync.milestones} class="size-4 accent-brand-600" />
									Milestones <span class="text-xs text-neutral-400">— bidirectional milestone sync</span>
								</label>
							</div>
							<div class="flex items-center gap-3">
								<Button variant="primary" type="submit">Save sync options</Button>
								{#if f?.githubSyncSaved}<span class="text-sm text-green-600">Saved</span>{/if}
							</div>
						</form>
					</section>

					<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
						<h3 class="text-sm font-semibold">Progress labels</h3>
						<p class="mt-1 mb-3 text-sm text-neutral-500">
							When a ticket enters a selected column, its linked GitHub issue gets a <code class="rounded bg-neutral-100 px-1 text-[11px] dark:bg-neutral-800">Status: …</code> label (created on GitHub on save). Add newly created lanes here.
						</p>
						<form method="POST" action="?/saveProgressLabels" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="flex flex-col gap-3">
							<div class="space-y-1.5">
								{#each data.columns as c (c.name)}
									<label class="flex items-center gap-2 text-sm">
										<input type="checkbox" name="progressColumn" value={c.name} checked={data.progressLabels.includes(c.name)} class="size-4 accent-brand-600" />
										<span class="size-2.5 shrink-0 rounded-full" style={`background:${c.color}`}></span>
										<span class="text-neutral-500">Status:</span> {c.name}
									</label>
								{:else}
									<p class="text-sm text-neutral-400">This project has no board columns.</p>
								{/each}
							</div>
							<div class="flex items-center gap-3">
								<Button variant="primary" type="submit">Save progress labels</Button>
								{#if f?.progressSaved}<span class="text-sm text-green-600">Saved{#if f.created} · {f.created} label{f.created === 1 ? '' : 's'} created on GitHub{/if}</span>{/if}
							</div>
						</form>
					</section>

					<section class="mt-6 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
						<h3 class="text-sm font-semibold">Close on GitHub</h3>
						<p class="mt-1 mb-3 text-sm text-neutral-500">
							When a ticket enters a selected column, its linked GitHub issue is closed (and reopened when moved back out). Leave all unchecked to fall back to the column category (Done / Canceled). Deleting a ticket always closes its issue.
						</p>
						<form method="POST" action="?/saveCloseColumns" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="flex flex-col gap-3">
							<div class="space-y-1.5">
								{#each data.columns as c (c.name)}
									<label class="flex items-center gap-2 text-sm">
										<input type="checkbox" name="closeColumn" value={c.name} checked={data.closeColumns.length ? data.closeColumns.includes(c.name) : (c.category === 'done' || c.category === 'canceled')} class="size-4 accent-brand-600" />
										<span class="size-2.5 shrink-0 rounded-full" style={`background:${c.color}`}></span>
										{c.name}
										{#if !data.closeColumns.length && (c.category === 'done' || c.category === 'canceled')}<span class="text-xs text-neutral-400">(by category)</span>{/if}
									</label>
								{:else}
									<p class="text-sm text-neutral-400">This project has no board columns.</p>
								{/each}
							</div>
							<div class="flex items-center gap-3">
								<Button variant="primary" type="submit">Save close columns</Button>
								{#if f?.closeSaved}<span class="text-sm text-green-600">Saved</span>{/if}
							</div>
						</form>
					</section>
				{/if}
			{:else if tab === 'discord'}
				<h2 class="mb-4 text-lg font-semibold tracking-tight">Discord</h2>
				<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
					<p class="mb-4 text-sm text-neutral-500">
						Announce project activity to a Discord channel. In Discord: <span class="font-medium">Channel settings → Integrations → Webhooks → New Webhook</span>, then paste the webhook URL here.
					</p>

					{#if f?.discordError}<p class="mb-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-300">{f.discordError}</p>{/if}
					{#if f?.discordSaved}<p class="mb-3 rounded-lg bg-green-50 p-2.5 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">Saved.</p>{/if}
					{#if f?.discordTested}<p class="mb-3 rounded-lg bg-green-50 p-2.5 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">Test message sent — check your channel.</p>{/if}
					{#if f?.discordRemoved}<p class="mb-3 rounded-lg bg-neutral-100 p-2.5 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Webhook removed.</p>{/if}

					<form method="POST" action="?/saveDiscord" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="flex flex-col gap-4">
						<Field label="Webhook URL">
							<Input
								name="webhookUrl"
								type="password"
								placeholder={data.discord.hasWebhook ? '•••••••• (leave blank to keep current)' : 'https://discord.com/api/webhooks/…'}
							/>
						</Field>

						<div>
							<span class="mb-2 block text-sm font-medium">Announce these events</span>
							<div class="flex flex-col gap-2">
								{#each DISCORD_EVENTS as ev (ev.key)}
									<label class="flex items-start gap-2.5 text-sm">
										<input
											type="checkbox"
											name="event"
											value={ev.key}
											checked={data.discord.events.includes(ev.key)}
											class="mt-0.5 size-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 dark:border-neutral-600 dark:bg-neutral-800"
										/>
										<span>
											<span class="font-medium">{ev.label}</span>
											<span class="block text-xs text-neutral-500">{ev.desc}</span>
										</span>
									</label>
								{/each}
							</div>
						</div>

						<div class="flex items-center gap-2">
							<Button variant="primary" type="submit">Save</Button>
							{#if data.discord.hasWebhook}
								<Button variant="default" type="submit" formaction="?/testDiscord"><Send size={14} /> Send test</Button>
								<Button variant="ghost" type="submit" formaction="?/removeDiscord">Remove</Button>
							{/if}
						</div>
					</form>

					{#if data.discord.hasWebhook}
						<p class="mt-3 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"><Check size={13} /> A webhook is configured for this project.</p>
					{/if}
				</section>
			{:else if tab === 'fields'}
				<h2 class="mb-4 text-lg font-semibold tracking-tight">Custom fields</h2>
				<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
					<p class="mb-4 text-sm text-neutral-500">Add typed fields that appear on every ticket in this project.</p>

					{#if localFields.length}
						<div class="mb-4 divide-y divide-neutral-100 dark:divide-neutral-800">
							{#each localFields as f (f.id)}
								<div class="flex items-center gap-3 py-2">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium">{f.name}</p>
										<p class="text-xs text-neutral-400">{FIELD_TYPE_LABELS[f.type]}{#if f.type === 'select' && f.options} · {f.options.join(', ')}{/if}</p>
									</div>
									<button type="button" onclick={() => removeField(f.id)} class="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Delete field"><Trash2 size={14} /></button>
								</div>
							{/each}
						</div>
					{/if}

					<div class="flex flex-wrap items-end gap-2">
						<div class="min-w-40 flex-1"><Field label="Field name"><Input bind:value={fName} placeholder="e.g. Severity" /></Field></div>
						<Field label="Type">
							<Select bind:value={fType} options={CUSTOM_FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))} class="w-36" />
						</Field>
						<Button variant="primary" onclick={addField}><Plus size={15} /> Add</Button>
					</div>
					{#if fType === 'select'}
						<div class="mt-2"><Field label="Options (comma-separated)"><Input bind:value={fOptions} placeholder="Low, Medium, High" /></Field></div>
					{/if}
				</section>
			{:else if tab === 'automation'}
				<h2 class="mb-1 text-lg font-semibold tracking-tight">Automation</h2>
				<p class="mb-4 text-sm text-neutral-500">When a trigger fires, run actions automatically. Runs in the background.</p>

				{#if rules.length}
					<section class="mb-6 divide-y divide-neutral-100 rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
						{#each rules as r (r.id)}
							<div class="flex items-start gap-3 p-4">
								<button type="button" onclick={() => toggleRule(r)} class={`mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition ${r.enabled ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-700'}`} aria-label="Toggle rule">
									<span class={`block size-4 rounded-full bg-white transition ${r.enabled ? 'translate-x-4' : ''}`}></span>
								</button>
								<div class="min-w-0 flex-1">
									<p class="text-sm font-medium {r.enabled ? '' : 'text-neutral-400'}">{r.name}</p>
									<p class="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
										<span class="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">{trigLabel(r.trigger?.type)}{#if r.trigger?.config?.columnName} → {r.trigger.config.columnName}{/if}{#if r.trigger?.config?.labelId} → {labelName(String(r.trigger.config.labelId))}{/if}{#if r.trigger?.config?.days} ({r.trigger.config.days}d){/if}</span>
										<ArrowRight size={12} class="text-neutral-300" />
										{#each r.actions ?? [] as a (a.type + JSON.stringify(a.config))}<span class="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">{summariseAction(a)}</span>{/each}
									</p>
								</div>
								<button type="button" onclick={() => deleteRule(r.id)} class="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Delete rule"><Trash2 size={14} /></button>
							</div>
						{/each}
					</section>
				{/if}

				<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
					<h3 class="mb-3 text-sm font-semibold">New rule</h3>
					<div class="mb-3"><Field label="Name"><Input bind:value={rName} placeholder="e.g. Auto-assign reviews" /></Field></div>

					<div class="mb-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/40">
						<p class="mb-1.5 text-xs font-medium text-neutral-400">WHEN</p>
						<div class="flex flex-wrap items-center gap-2">
							<Select bind:value={rTrigger} options={WORKFLOW_TRIGGERS.map((t) => ({ value: t.type, label: t.label }))} class="w-56" />
							{#if triggerDef?.config === 'column'}
								<Select bind:value={rTriggerColumn} options={columnOpts} placeholder="column" class="w-40" />
							{:else if triggerDef?.config === 'label'}
								<Select bind:value={rTriggerLabel} options={labelOpts} placeholder="label" class="w-40" />
							{:else if triggerDef?.config === 'days'}
								<Input type="number" value={String(rTriggerDays)} oninput={(e) => (rTriggerDays = Number((e.currentTarget as HTMLInputElement).value) || 0)} class="w-20" /> <span class="text-sm text-neutral-500">days</span>
							{/if}
						</div>
					</div>

					<div class="mb-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/40">
						<div class="mb-1.5 flex items-center justify-between">
							<p class="text-xs font-medium text-neutral-400">IF (optional)</p>
							<button type="button" onclick={addCond} class="text-xs text-brand-600 hover:underline dark:text-brand-400">+ condition</button>
						</div>
						{#each rConds as c, i (i)}
							<div class="mb-1.5 flex items-center gap-2">
								<Select value={c.type} onchange={(v) => { rConds[i] = { type: v, value: '' }; }} options={WORKFLOW_CONDITIONS.map((x) => ({ value: x.type, label: x.label }))} class="w-40" />
								{#if c.type === 'priority'}
									<Select value={c.value} onchange={(v) => { rConds[i].value = v; }} options={priorityOpts} placeholder="priority" class="w-32" />
								{:else}
									<Select value={c.value} onchange={(v) => { rConds[i].value = v; }} options={labelOpts} placeholder="label" class="w-40" />
								{/if}
								<button type="button" onclick={() => (rConds = rConds.filter((_, j) => j !== i))} class="text-neutral-400 hover:text-red-600" aria-label="Remove"><Trash2 size={13} /></button>
							</div>
						{:else}
							<p class="text-xs text-neutral-400">Always runs (no conditions).</p>
						{/each}
					</div>

					<div class="mb-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/40">
						<div class="mb-1.5 flex items-center justify-between">
							<p class="text-xs font-medium text-neutral-400">THEN</p>
							<button type="button" onclick={addAction} class="text-xs text-brand-600 hover:underline dark:text-brand-400">+ action</button>
						</div>
						{#each rActs as a, i (i)}
							<div class="mb-1.5 flex items-center gap-2">
								<Select value={a.type} onchange={(v) => { rActs[i] = { type: v, config: {} }; }} options={WORKFLOW_ACTIONS.map((x) => ({ value: x.type, label: x.label }))} class="w-44" />
								{#if a.type === 'add_label'}
									<Select value={String(a.config.labelId ?? '')} onchange={(v) => { rActs[i].config = { labelId: v }; }} options={labelOpts} placeholder="label" class="w-40" />
								{:else if a.type === 'assign'}
									<Select value={String(a.config.userId ?? '')} onchange={(v) => { rActs[i].config = { userId: v }; }} options={memberOpts} placeholder="user" class="w-40" />
								{:else if a.type === 'set_priority'}
									<Select value={String(a.config.priority ?? '')} onchange={(v) => { rActs[i].config = { priority: v }; }} options={priorityOpts} placeholder="priority" class="w-32" />
								{:else if a.type === 'move_to_column'}
									<Select value={String(a.config.columnName ?? '')} onchange={(v) => { rActs[i].config = { columnName: v }; }} options={columnOpts} placeholder="column" class="w-40" />
								{:else if a.type === 'post_comment'}
									<Input value={String(a.config.body ?? '')} oninput={(e) => { rActs[i].config = { body: (e.currentTarget as HTMLInputElement).value }; }} placeholder="Comment text" class="flex-1" />
								{/if}
								<button type="button" onclick={() => (rActs = rActs.filter((_, j) => j !== i))} class="text-neutral-400 hover:text-red-600" aria-label="Remove"><Trash2 size={13} /></button>
							</div>
						{/each}
					</div>

					<div class="flex items-center gap-3">
						<Button variant="primary" onclick={createRule}><Plus size={15} /> Add rule</Button>
						{#if ruleErr}<span class="text-sm text-red-600">{ruleErr}</span>{/if}
					</div>
				</section>
			{:else if tab === 'danger'}
				<h2 class="mb-4 text-lg font-semibold tracking-tight">Danger zone</h2>
				<section class="rounded-xl border border-red-200 p-5 dark:border-red-900/50">
					<h3 class="text-sm font-semibold text-red-600">Delete project</h3>
					<p class="mt-1 mb-3 text-sm text-neutral-500">Deleting a project removes its boards, tickets, and suggestions. This cannot be undone.</p>
					<Button variant="danger" onclick={() => (deleteOpen = true)}><Trash2 size={15} /> Delete project</Button>
				</section>
			{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete project?"
	description="This permanently removes the project and all of its boards, tickets, and suggestions."
	confirmLabel="Delete project"
	action="?/deleteProject"
	requireText={data.project.name}
/>
