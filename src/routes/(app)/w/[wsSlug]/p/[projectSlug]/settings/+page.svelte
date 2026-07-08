<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Trash2, Check, GitBranch, GitMerge, Settings, Users, TriangleAlert, Plug, SlidersHorizontal, Plus, Zap, ArrowRight, Map, ExternalLink, RefreshCw, Code } from '@lucide/svelte';
	import { EMBED_WIDGETS, iframeSnippet, pictureSnippet, badgeSnippet, ROADMAP_LANE_KEYS, ROADMAP_LANE_LABELS } from '$lib/embeds';
	import SettingsNavHeader from '$lib/components/app/SettingsNavHeader.svelte';
	import { PALETTE } from '$lib/colors';
	import { PRIORITIES } from '$lib/constants';
	import { PRIORITY_META } from '$lib/priority';
	import { CUSTOM_FIELD_TYPES, FIELD_TYPE_LABELS } from '$lib/customFields';
	import { WORKFLOW_TRIGGERS, WORKFLOW_ACTIONS, WORKFLOW_CONDITIONS } from '$lib/workflow';
	import { CATEGORY_META, CATEGORY_ORDER, byCategory, descriptor } from '$lib/integrations/catalog';
	import { cn } from '$lib/utils/cn';
	import Button from '$lib/components/ui/Button.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import IntegrationCard from '$lib/components/integrations/IntegrationCard.svelte';
	import NotificationConfigForm from '$lib/components/integrations/NotificationConfigForm.svelte';

	let { data, form } = $props();
	const f = $derived(form as Record<string, any> | null);

	const roleOptions = [
		{ value: 'maintainer', label: 'Maintainer' },
		{ value: 'collaborator', label: 'Collaborator' },
		{ value: 'viewer', label: 'Viewer' }
	];
	const roleLabel = (v: string) => roleOptions.find((o) => o.value === v)?.label ?? v;

	let color = $state<string>(data.project.color ?? PALETTE[6]);
	let icon = $state<string>(data.project.icon ?? '');
	let visibility = $state(data.project.visibility);
	let deleteOpen = $state(false);
	let selectedRepo = $state('');
	let resyncing = $state(false);

	const tabs = [
		{ id: 'general', label: 'General', icon: Settings },
		{ id: 'roadmap', label: 'Roadmap', icon: Map },
		{ id: 'members', label: 'Collaborators', icon: Users },
		{ id: 'integrations', label: 'Integrations', icon: Plug },
		{ id: 'fields', label: 'Fields', icon: SlidersHorizontal },
		{ id: 'automation', label: 'Automation', icon: Zap },
		{ id: 'embeds', label: 'Embeds', icon: Code },
		{ id: 'danger', label: 'Danger', icon: TriangleAlert }
	] as const;

	// ── Integration cards (grouped by category) ──────────────────────────────
	type CardStatus = 'connected' | 'disconnected' | 'soon' | 'unavailable';
	function integrationStatus(key: string): CardStatus {
		if (key === 'github')
			return !data.githubEnabled ? 'unavailable' : data.linkedRepo ? 'connected' : 'disconnected';
		if (key === 'gitlab') return 'soon';
		if (key === 'discord' || key === 'slack') {
			const s = (data.notifications as Record<string, { hasWebhook: boolean; enabled: boolean }>)[key];
			return s?.hasWebhook && s?.enabled ? 'connected' : 'disconnected';
		}
		return 'disconnected';
	}
	let selectedIntegration = $state<string>('github');
	const selectedDesc = $derived(descriptor(selectedIntegration));

	// ── Roadmap lane options ─────────────────────────────────────────────────
	const ROADMAP_LANES = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'shipped', label: 'Shipped' },
		{ value: 'hidden', label: 'Hidden' }
	] as const;
	const laneLabel = (v: string) => ROADMAP_LANES.find((l) => l.value === v)?.label ?? v;

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

	// ── Embeds tab ───────────────────────────────────────────────────────────
	let embed = $state(structuredClone(data.embedConfig));
	let embedRev = $state(0); // bumps on save to reload the live previews
	const embedBase = $derived(`${data.origin}/embed/${data.workspace.slug}/${data.project.slug}`);
	const themeOpts = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];
	const badgeMetricOpts = [
		{ value: 'release', label: 'Latest release' },
		{ value: 'shipped', label: 'Releases shipped' }
	];
	function toggleLane(key: string) {
		const l = embed.roadmap.lanes;
		embed.roadmap.lanes = l.includes(key) ? l.filter((x) => x !== key) : [...l, key];
	}
	const badgeSnip = $derived(badgeSnippet(data.origin, data.workspace.slug, data.project.slug, data.project.name));
</script>

<svelte:head><title>Settings · {data.project.name}</title></svelte:head>

<div class="flex h-full min-w-0 flex-col lg:flex-row">
	<!-- Settings nav (secondary sidebar) -->
	<aside class="flex w-full shrink-0 flex-col border-b border-neutral-200 bg-neutral-50 lg:h-screen lg:w-56 lg:border-r lg:border-b-0 dark:border-neutral-800 dark:bg-neutral-900/40">
		<SettingsNavHeader
			scope="project"
			title={data.project.name}
			backHref={base}
			backLabel="Back to project"
			color={data.project.color}
			icon={data.project.icon}
		/>
		<nav class="flex flex-row gap-1 overflow-x-auto px-2 py-2 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-x-visible lg:overflow-y-auto">
			{#each tabs as t (t.id)}
				<button
					type="button"
					onclick={() => (tab = t.id)}
					class={cn(
						'flex w-auto shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm whitespace-nowrap lg:w-full',
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
		<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
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

				<p class="mt-4 text-sm text-neutral-500">
					Publish your roadmap, changelog, feedback and more to any site from the <button type="button" onclick={() => (tab = 'embeds')} class="font-medium text-brand-600 hover:underline">Embeds</button> tab.
				</p>
			{:else if tab === 'roadmap'}
				<h2 class="mb-1 text-lg font-semibold tracking-tight">Roadmap</h2>
				<p class="mb-4 text-sm text-neutral-500">
					Control the public roadmap. Each board column maps to a lane; choose <em>Hidden</em> to keep a column off the roadmap.
				</p>
				<form
					method="POST"
					action="?/saveRoadmap"
					use:enhance={() => async ({ update }) => { await update({ reset: false }); }}
					class="flex flex-col gap-5 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
				>
					<label class="flex items-start gap-3">
						<input type="checkbox" name="roadmapEnabled" checked={data.roadmapEnabled} class="mt-0.5 size-4 rounded border-neutral-300 dark:border-neutral-600" />
						<span>
							<span class="text-sm font-medium text-neutral-800 dark:text-neutral-200">Show roadmap on the public page</span>
							<span class="block text-xs text-neutral-500">When off, the Roadmap tab and its public URL are hidden.</span>
						</span>
					</label>

					{#if data.roadmap.columns.length}
						<div class="rounded-lg border border-neutral-200 dark:border-neutral-800">
							<div class="flex items-center justify-between border-b border-neutral-100 px-4 py-2 text-xs font-medium tracking-wide text-neutral-400 uppercase dark:border-neutral-800">
								<span>Column</span><span>Lane</span>
							</div>
							{#each data.roadmap.columns as c (c.id)}
								<div class="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-2.5 last:border-b-0 dark:border-neutral-800">
									<span class="flex min-w-0 items-center gap-2">
										<span class="size-2.5 shrink-0 rounded-full" style={`background:${c.color}`}></span>
										<span class="truncate text-sm">{c.name}</span>
									</span>
									<select
										name={`lane_${c.id}`}
										class="shrink-0 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
									>
										<option value="" selected={!c.lane}>Default ({laneLabel(c.defaultLane)})</option>
										{#each ROADMAP_LANES as l (l.value)}
											<option value={l.value} selected={c.lane === l.value}>{l.label}</option>
										{/each}
									</select>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-neutral-400">No board columns to configure yet.</p>
					{/if}

					<div class="flex items-center gap-3">
						<Button type="submit" size="sm">Save roadmap</Button>
						{#if f?.roadmapSaved}<span class="text-sm text-green-600">Saved</span>{/if}
						{#if data.isPublic}
							<a href={`/${data.workspace.slug}/${data.project.slug}/roadmap`} target="_blank" rel="noreferrer" class="ml-auto text-xs font-medium text-neutral-500 hover:text-neutral-700">View public roadmap →</a>
						{/if}
					</div>
				</form>
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

					{#if data.invites.length}
						<div class="mt-5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
							<p class="mb-2 text-xs font-medium text-neutral-500">Active invite codes</p>
							<ul class="divide-y divide-neutral-100 dark:divide-neutral-800">
								{#each data.invites as inv (inv.id)}
									<li class="flex items-center gap-3 py-2 text-sm">
										<span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium capitalize dark:bg-neutral-800">{roleLabel(inv.roleGrant)}</span>
										<span class="min-w-0 flex-1 truncate text-neutral-500">{inv.uses}/{inv.maxUses} used{#if inv.note} · {inv.note}{/if}</span>
										<form method="POST" action="?/deleteInvite" use:enhance>
											<input type="hidden" name="id" value={inv.id} />
											<button class="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" aria-label="Delete invite"><Trash2 size={14} /></button>
										</form>
									</li>
								{/each}
							</ul>
							<p class="mt-2 text-[11px] text-neutral-400">Codes can't be shown again after they're generated — delete and regenerate if one leaks.</p>
						</div>
					{/if}
				</section>
			{:else if tab === 'integrations'}
				<h2 class="mb-1 text-lg font-semibold tracking-tight">Integrations</h2>
				<p class="mb-5 text-sm text-neutral-500">Connect this project to an external issue tracker and announce activity to your channels.</p>

				{#each CATEGORY_ORDER as cat (cat)}
					<section class="mb-6">
						<h3 class="mb-1 text-sm font-semibold">{CATEGORY_META[cat].label}</h3>
						<p class="mb-3 text-xs text-neutral-500">{CATEGORY_META[cat].blurb}</p>
						<div class="grid gap-3 sm:grid-cols-2">
							{#each byCategory(cat) as d (d.key)}
								<IntegrationCard
									name={d.name}
									blurb={d.blurb}
									icon={d.key}
									status={integrationStatus(d.key)}
									selected={selectedIntegration === d.key}
									onclick={() => (selectedIntegration = d.key)}
								/>
							{/each}
						</div>
					</section>
				{/each}

				{#if selectedDesc}
					<section class="mt-2 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="text-sm font-semibold">{selectedDesc.name}</h3>
							{#if selectedDesc.docsUrl}
								<a href={selectedDesc.docsUrl} target="_blank" rel="noreferrer" class="flex items-center gap-1 text-xs text-brand-600 hover:underline"><ExternalLink size={12} /> Docs</a>
							{/if}
						</div>

						{#if selectedIntegration === 'github'}
				<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
					<h3 class="flex items-center gap-2 text-sm font-semibold"><GitBranch size={15} /> Linked repository</h3>
					<p class="mt-1 mb-4 text-sm text-neutral-500">Sync issues and pull requests. GitHub is the source of truth on conflicts.</p>
					{#if !data.githubEnabled}
						<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">The GitHub App isn't configured on this instance yet.</p>
					{:else if data.linkedRepo}
						<div class="flex items-center justify-between rounded-lg bg-neutral-100 p-3 dark:bg-neutral-900">
							<a href={`https://github.com/${data.linkedRepo}`} target="_blank" rel="noreferrer" class="flex items-center gap-2 text-sm font-medium hover:underline"><GitBranch size={14} /> {data.linkedRepo}</a>
							<div class="flex items-center gap-3">
								<form method="POST" action="?/resyncGithub" use:enhance={() => { resyncing = true; return async ({ update }) => { await update({ reset: false }); resyncing = false; }; }}>
									<button type="submit" disabled={resyncing} class="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-600 disabled:opacity-60">
										<RefreshCw size={12} class={resyncing ? 'animate-spin' : ''} /> {resyncing ? 'Resyncing…' : 'Resync'}
									</button>
								</form>
								<form method="POST" action="?/unlinkRepo" use:enhance>
									<button class="text-xs text-neutral-400 hover:text-red-600">Unlink</button>
								</form>
							</div>
						</div>
						{#if f?.resynced}
							<p class="mt-2 text-sm text-green-600">
								{#if f.missingLocal || f.missingRemote}
									Reconciling{#if f.missingLocal} · {f.missingLocal} issue{f.missingLocal === 1 ? '' : 's'} → OpenTrack{/if}{#if f.missingRemote} · {f.missingRemote} ticket{f.missingRemote === 1 ? '' : 's'} → GitHub{/if}. Changes appear as the sync runs.
								{:else}
									Already in sync — nothing missing on either side.
								{/if}
							</p>
						{:else if f?.error}
							<p class="mt-2 text-sm text-red-600">{f.error}</p>
						{/if}
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
					{:else if selectedIntegration === 'discord'}
						<NotificationConfigForm
							projectId={data.project.id}
							providerKey="discord"
							providerName="Discord"
							placeholder={data.notifications.discord.hasWebhook ? '•••••••• (leave blank to keep current)' : 'https://discord.com/api/webhooks/…'}
							setupHint="In Discord: Channel settings → Integrations → Webhooks → New Webhook, then paste the webhook URL here."
							initial={data.notifications.discord}
						/>
					{:else if selectedIntegration === 'slack'}
						<NotificationConfigForm
							projectId={data.project.id}
							providerKey="slack"
							providerName="Slack"
							placeholder={data.notifications.slack.hasWebhook ? '•••••••• (leave blank to keep current)' : 'https://hooks.slack.com/services/…'}
							setupHint="In Slack: add an Incoming Webhook app to your workspace, pick a channel, then paste its webhook URL here."
							initial={data.notifications.slack}
						/>
					{:else if selectedIntegration === 'gitlab'}
						<div class="rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
							GitLab issue sync is coming soon. The provider is scaffolded and slots into the same abstraction; per-ticket issue mapping and inbound webhooks are still in progress.
						</div>
					{/if}
					</section>
				{/if}
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
							<div class="mb-1.5 flex flex-wrap items-center gap-2">
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
							<div class="mb-1.5 flex flex-wrap items-center gap-2">
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
			{:else if tab === 'embeds'}
				<h2 class="mb-1 text-lg font-semibold tracking-tight">Embeds</h2>
				<p class="mb-5 text-sm text-neutral-500">Publish live widgets to any website. Configure each one, then copy the snippet. Changes apply after you save.</p>

				{#if !data.isPublic}
					<p class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
						Embeds are only available for public projects. Make this project public in <button type="button" onclick={() => (tab = 'general')} class="font-medium underline">General</button> to use them.
					</p>
				{:else}
					<form method="POST" action="?/saveEmbeds" use:enhance={() => async ({ update, result }) => { await update({ reset: false }); if (result.type === 'success') embedRev++; }} class="flex flex-col gap-4">
						<input type="hidden" name="config" value={JSON.stringify(embed)} />

						{#each EMBED_WIDGETS as w (w.key)}
							{@const cfg = embed[w.key]}
							{@const iSnip = iframeSnippet(data.origin, data.workspace.slug, data.project.slug, w, data.project.name)}
							<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
								<div class="flex items-start justify-between gap-3">
									<div>
										<h3 class="text-sm font-semibold">{w.label}</h3>
										<p class="mt-0.5 text-xs text-neutral-500">{w.description}</p>
									</div>
									<label class="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
										<input type="checkbox" bind:checked={cfg.enabled} class="size-4 accent-brand-600" /> Enabled
									</label>
								</div>

								{#if cfg.enabled}
									<div class="mt-4 grid gap-3 sm:grid-cols-2">
										<label class="flex flex-col gap-1 text-xs font-medium text-neutral-500">Theme
											<select bind:value={cfg.theme} class="rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">
												{#each themeOpts as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
											</select>
										</label>
										<label class="flex flex-col gap-1 text-xs font-medium text-neutral-500">Max items
											<input type="number" min="1" max="50" bind:value={cfg.limit} class="rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-800" />
										</label>
										<label class="flex flex-col gap-1 text-xs font-medium text-neutral-500">Accent (hex)
											<input type="text" placeholder={data.projectColor ?? '#6366f1'} value={cfg.accent ?? ''} oninput={(e) => (cfg.accent = e.currentTarget.value.trim() || null)} class="rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-800" />
										</label>
										<div class="flex items-end gap-4 pb-1 text-sm">
											<label class="flex items-center gap-1.5"><input type="checkbox" bind:checked={cfg.showHeader} class="size-4 accent-brand-600" /> Header</label>
											<label class="flex items-center gap-1.5"><input type="checkbox" bind:checked={cfg.showFooter} class="size-4 accent-brand-600" /> Footer</label>
										</div>
									</div>

									{#if w.hasLanes}
										<div class="mt-3">
											<span class="text-xs font-medium text-neutral-500">Lanes</span>
											<div class="mt-1 flex flex-wrap gap-3 text-sm">
												{#each ROADMAP_LANE_KEYS as lk (lk)}
													<label class="flex items-center gap-1.5"><input type="checkbox" checked={embed.roadmap.lanes.includes(lk)} onchange={() => toggleLane(lk)} class="size-4 accent-brand-600" /> {ROADMAP_LANE_LABELS[lk]}</label>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Snippets -->
									<div class="mt-4 space-y-2">
										<div>
											<div class="mb-1 flex items-center justify-between">
												<span class="text-xs font-medium text-neutral-500">iframe</span>
												<button type="button" onclick={() => copy(iSnip)} class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"><Copy size={12} /> Copy</button>
											</div>
											<code class="block overflow-x-auto rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-[11px] whitespace-pre text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400">{iSnip}</code>
										</div>
										{#if w.svg}
											{@const pSnip = pictureSnippet(data.origin, data.workspace.slug, data.project.slug, w, data.project.name)}
											<div>
												<div class="mb-1 flex items-center justify-between">
													<span class="text-xs font-medium text-neutral-500">Markdown / README (SVG, auto dark)</span>
													<button type="button" onclick={() => copy(pSnip)} class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"><Copy size={12} /> Copy</button>
												</div>
												<code class="block overflow-x-auto rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-[11px] whitespace-pre text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400">{pSnip}</code>
											</div>
										{/if}
									</div>

									<!-- Live preview (reflects saved settings) -->
									<div class="mt-4">
										<div class="mb-1 flex items-center justify-between text-xs text-neutral-400">
											<span>Preview</span>
											<a href={`${embedBase}/${w.path}`} target="_blank" rel="noreferrer" class="flex items-center gap-1 text-brand-600 hover:underline">Open <ExternalLink size={11} /></a>
										</div>
										{#key embedRev}
											<iframe src={`${embedBase}/${w.path}?v=${embedRev}`} title={`${w.label} preview`} class="w-full rounded-lg border border-neutral-200 dark:border-neutral-800" style={`height:${w.height}px`} loading="lazy"></iframe>
										{/key}
									</div>
								{/if}
							</section>
						{/each}

						<!-- Badge -->
						<section class="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
							<div class="flex items-start justify-between gap-3">
								<div>
									<h3 class="text-sm font-semibold">Badge</h3>
									<p class="mt-0.5 text-xs text-neutral-500">A shields-style badge for READMEs — latest release or count shipped.</p>
								</div>
								<label class="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
									<input type="checkbox" bind:checked={embed.badge.enabled} class="size-4 accent-brand-600" /> Enabled
								</label>
							</div>
							{#if embed.badge.enabled}
								<div class="mt-4 grid gap-3 sm:grid-cols-3">
									<label class="flex flex-col gap-1 text-xs font-medium text-neutral-500">Metric
										<select bind:value={embed.badge.metric} class="rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">
											{#each badgeMetricOpts as m (m.value)}<option value={m.value}>{m.label}</option>{/each}
										</select>
									</label>
									<label class="flex flex-col gap-1 text-xs font-medium text-neutral-500">Theme
										<select bind:value={embed.badge.theme} class="rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-sm text-neutral-900 dark:border-neutral-800 dark:text-neutral-100">
											{#each themeOpts as t (t.value)}<option value={t.value}>{t.label}</option>{/each}
										</select>
									</label>
									<label class="flex flex-col gap-1 text-xs font-medium text-neutral-500">Label
										<input type="text" bind:value={embed.badge.label} placeholder={embed.badge.metric} class="rounded-lg border border-neutral-200 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-800" />
									</label>
								</div>
								<div class="mt-4">
									<div class="mb-1 flex items-center justify-between">
										<span class="text-xs font-medium text-neutral-500">Markdown / README</span>
										<button type="button" onclick={() => copy(badgeSnip)} class="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"><Copy size={12} /> Copy</button>
									</div>
									<code class="block overflow-x-auto rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-[11px] whitespace-pre text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400">{badgeSnip}</code>
									{#key embedRev}
										<img src={`${embedBase}/badge.svg?v=${embedRev}`} alt="Badge preview" class="mt-3" />
									{/key}
								</div>
							{/if}
						</section>

						<div class="flex items-center gap-3">
							<Button variant="primary" type="submit">Save embed settings</Button>
							{#if f?.embedsSaved}<span class="text-sm text-green-600">Saved</span>{/if}
							{#if f?.error}<span class="text-sm text-red-600">{f.error}</span>{/if}
						</div>
					</form>
				{/if}
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
