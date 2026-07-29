<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Copy, Trash2, Check, GitBranch, Settings, Users, TriangleAlert, Plug, SlidersHorizontal, Plus, Zap, ArrowRight, Map, ExternalLink, RefreshCw, Code } from '@lucide/svelte';
	import { EMBED_WIDGETS, iframeSnippet, pictureSnippet, badgeSnippet, ROADMAP_LANE_KEYS, ROADMAP_LANE_LABELS } from '$lib/embeds';
	import SettingsShell from '$lib/components/app/SettingsShell.svelte';
	import { PALETTE } from '$lib/colors';
	import { PRIORITIES } from '$lib/constants';
	import { PRIORITY_META } from '$lib/priority';
	import { CUSTOM_FIELD_TYPES, FIELD_TYPE_LABELS } from '$lib/customFields';
	import { WORKFLOW_TRIGGERS, WORKFLOW_ACTIONS, WORKFLOW_CONDITIONS } from '$lib/workflow';
	import { CATEGORY_META, CATEGORY_ORDER, byCategory, descriptor } from '$lib/integrations/catalog';
	import { cn } from '$lib/utils/cn';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Checkbox from '$lib/components/ui/Checkbox.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ConfirmPopover from '$lib/components/ui/ConfirmPopover.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import SaveBar from '$lib/components/ui/SaveBar.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { createDirtyGuard } from '$lib/dirty';
	import { toast } from '$lib/toast';
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

	// ── General (bound so nothing is lost on a tab switch) ───────────────────
	let name = $state(data.project.name);
	let description = $state(data.project.description ?? '');
	let icon = $state<string>(data.project.icon ?? '');
	let color = $state<string>(data.project.color ?? PALETTE[6]);
	let visibility = $state(data.project.visibility);
	let allowPublicComments = $state(data.project.allowPublicComments);
	let deleteOpen = $state(false);
	let selectedRepo = $state('');
	let resyncing = $state(false);

	const TAB_KEYS = ['general', 'roadmap', 'members', 'integrations', 'fields', 'automation', 'embeds', 'danger'] as const;
	type Tab = (typeof TAB_KEYS)[number];
	const items = [
		{ label: 'General', icon: Settings, tab: 'general' },
		{ label: 'Roadmap', icon: Map, tab: 'roadmap' },
		{ label: 'Collaborators', icon: Users, tab: 'members' },
		{ label: 'Integrations', icon: Plug, tab: 'integrations' },
		{ label: 'Fields', icon: SlidersHorizontal, tab: 'fields' },
		{ label: 'Automation', icon: Zap, tab: 'automation' },
		{ label: 'Embeds', icon: Code, tab: 'embeds' },
		{ label: 'Danger', icon: TriangleAlert, tab: 'danger' }
	];
	// The URL is the source of truth for the active tab (deep-linkable, survives refresh).
	const tab = $derived<Tab>(
		(TAB_KEYS as readonly string[]).includes(page.url.searchParams.get('tab') ?? '')
			? (page.url.searchParams.get('tab') as Tab)
			: 'general'
	);
	const base = $derived(`/w/${data.workspace.slug}/p/${data.project.slug}`);
	// Every settings form folds the active tab into its action so a no-JS post
	// (or a JS one that fails and falls back) re-renders on the same tab.
	const actionFor = (name: string) => `?tab=${tab}&/${name}`;
	function switchTab(e: MouseEvent, t: Tab) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		void goto(`?tab=${t}`, { keepFocus: true, noScroll: true });
	}

	function copy(text: string) {
		navigator.clipboard?.writeText(text);
	}

	// One page-level dirty guard. General/Roadmap/Embeds are each the only edit-
	// then-save form on their tab, so the shared `dirty` store covers them
	// correctly; the three GitHub sub-forms below coexist on one tab and track
	// their own local flags for accurate per-form SaveBars, while still using
	// named keys here so the guard blocks navigation whichever is dirty.
	const dirtyGuard = createDirtyGuard();
	const dirty = dirtyGuard.dirty;
	const pending = dirtyGuard.pending;
	let savingGeneral = $state(false);
	let savingRoadmap = $state(false);
	let savingSync = $state(false);
	let savingProgress = $state(false);
	let savingClose = $state(false);
	let savingEmbeds = $state(false);

	function discardGeneral() {
		name = data.project.name;
		description = data.project.description ?? '';
		icon = data.project.icon ?? '';
		color = data.project.color ?? PALETTE[6];
		visibility = data.project.visibility;
		allowPublicComments = data.project.allowPublicComments;
		dirtyGuard.markClean();
	}

	// ── Destruction Tier 2 (member remove, GitHub unlink) — the real per-row
	// form carries the id; the button just gates submission behind a styled
	// confirm dialog. No-JS still works (real submit button). ─────────────────
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

	// ── Roadmap ────────────────────────────────────────────────────────────
	const ROADMAP_LANES = [
		{ value: 'planned', label: 'Planned' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'shipped', label: 'Shipped' },
		{ value: 'hidden', label: 'Hidden' }
	] as const;
	const laneLabel = (v: string) => ROADMAP_LANES.find((l) => l.value === v)?.label ?? v;
	let roadmapEnabled = $state(data.roadmapEnabled);
	let laneOverrides = $state<Record<string, string>>(
		Object.fromEntries(data.roadmap.columns.map((c) => [c.id, c.lane ?? '']))
	);
	function discardRoadmap() {
		roadmapEnabled = data.roadmapEnabled;
		laneOverrides = Object.fromEntries(data.roadmap.columns.map((c) => [c.id, c.lane ?? '']));
		dirtyGuard.markClean();
	}

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

	// GitHub sync/progress/close coexist on one detail panel — each tracks its
	// own dirty flag so only the edited form's SaveBar appears.
	let syncDirty = $state(false);
	let syncAssignees = $state(data.githubSync.assignees);
	let syncLabels = $state(data.githubSync.labels);
	let syncPriority = $state(data.githubSync.priority);
	let syncMilestones = $state(data.githubSync.milestones);
	function discardSync() {
		syncAssignees = data.githubSync.assignees;
		syncLabels = data.githubSync.labels;
		syncPriority = data.githubSync.priority;
		syncMilestones = data.githubSync.milestones;
		syncDirty = false;
		dirtyGuard.markClean('sync');
	}

	let progressDirty = $state(false);
	let progressColumns = $state<string[]>([...data.progressLabels]);
	function toggleProgress(name: string, on: boolean) {
		progressColumns = on ? [...new Set([...progressColumns, name])] : progressColumns.filter((n) => n !== name);
		progressDirty = true;
		dirtyGuard.markDirty('progress');
	}
	function discardProgress() {
		progressColumns = [...data.progressLabels];
		progressDirty = false;
		dirtyGuard.markClean('progress');
	}

	const defaultCloseColumns = () =>
		data.closeColumns.length
			? [...data.closeColumns]
			: data.columns.filter((c) => c.category === 'done' || c.category === 'canceled').map((c) => c.name);
	let closeDirty = $state(false);
	let closeColumnsSel = $state<string[]>(defaultCloseColumns());
	function toggleClose(name: string, on: boolean) {
		closeColumnsSel = on ? [...new Set([...closeColumnsSel, name])] : closeColumnsSel.filter((n) => n !== name);
		closeDirty = true;
		dirtyGuard.markDirty('close');
	}
	function discardClose() {
		closeColumnsSel = defaultCloseColumns();
		closeDirty = false;
		dirtyGuard.markClean('close');
	}

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
		toast('Rule added.', { tone: 'success' });
	}
	async function setRuleEnabled(r: any, enabled: boolean) {
		r.enabled = enabled;
		rules = rules;
		await fetch(`/api/workflow-rules/${r.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }) });
	}
	// Destruction Tier 1: scoped, frequently-redone automation config.
	async function deleteRule(id: string) {
		rules = rules.filter((r) => r.id !== id);
		await fetch(`/api/workflow-rules/${id}`, { method: 'DELETE' });
		toast('Rule deleted.', { tone: 'success' });
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
		if (res.ok) {
			fName = ''; fOptions = ''; fType = 'text';
			await refreshFields();
			toast('Field added.', { tone: 'success' });
		} else {
			toast('Could not add field.', { tone: 'error' });
		}
	}
	// Destruction Tier 1: scoped, frequently-redone project config.
	async function removeField(id: string) {
		localFields = localFields.filter((fld) => fld.id !== id);
		await fetch(`/api/fields/${id}`, { method: 'DELETE' });
		toast('Field deleted.', { tone: 'success' });
	}

	// ── Embeds — master-detail: one widget list, one lazy-mounted preview ────
	let embed = $state(structuredClone(data.embedConfig));
	let embedRev = $state(0); // bumps on save to reload the one mounted preview
	let selectedEmbed = $state<'roadmap' | 'changelog' | 'feedback' | 'knownIssues' | 'badge'>('roadmap');
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
	function discardEmbeds() {
		embed = structuredClone(data.embedConfig);
		dirtyGuard.markClean();
	}

	// Every settings form wraps SaveBar + toast.success on the reused flags;
	// `saved` is shared by updateGeneral/setRole/removeMember so it's gated to
	// the tab that actually means "General was saved" — the Tier-2 flows below
	// toast at confirm-time instead, matching the workspace-settings pattern.
	$effect(() => {
		if (f?.saved && tab === 'general') {
			dirtyGuard.markClean();
			toast('Project saved.', { tone: 'success' });
		} else if (f?.roadmapSaved) {
			dirtyGuard.markClean();
			toast('Roadmap saved.', { tone: 'success' });
		} else if (f?.linked) {
			toast('Repository linked.', { tone: 'success' });
		} else if (f?.githubSyncSaved) {
			syncDirty = false;
			dirtyGuard.markClean('sync');
			toast('Sync options saved.', { tone: 'success' });
		} else if (f?.progressSaved) {
			progressDirty = false;
			dirtyGuard.markClean('progress');
			toast(`Progress labels saved.${f.created ? ` ${f.created} label${f.created === 1 ? '' : 's'} created on GitHub.` : ''}`, { tone: 'success' });
		} else if (f?.closeSaved) {
			closeDirty = false;
			dirtyGuard.markClean('close');
			toast('Close columns saved.', { tone: 'success' });
		} else if (f?.embedsSaved) {
			dirtyGuard.markClean();
			embedRev++;
			toast('Embed settings saved.', { tone: 'success' });
		}
	});
</script>

<svelte:head><title>Settings · {data.project.name}</title></svelte:head>

<SettingsShell
	scope="project"
	{items}
	active={tab}
	backHref={base}
	backLabel="Back to project"
	title={data.project.name}
	color={data.project.color}
	icon={data.project.icon}
>
	{#if tab === 'general'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">General</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Identity, visibility, and public settings.</p>
		</header>
		<section>
			<form
				method="POST"
				action={actionFor('updateGeneral')}
				use:enhance={() => { savingGeneral = true; return async ({ update }) => { await update({ reset: false }); savingGeneral = false; }; }}
				oninput={() => dirtyGuard.markDirty()}
				class="flex flex-col gap-4"
			>
				<div class="flex items-end gap-3">
					<div class="flex flex-col gap-1.5">
						<span class="text-sm font-medium text-[var(--dim)]">Icon</span>
						<div class="flex items-center gap-2">
							<div class="mono-display grid size-9 shrink-0 place-items-center rounded-[3px] text-base text-[var(--ground)]" style={`background:${color}`}>
								{#if icon}{icon}{:else}{(name || 'P').slice(0, 1).toUpperCase()}{/if}
							</div>
							<Input name="icon" bind:value={icon} placeholder="🚀" class="w-16 text-center text-lg" maxlength={8} />
						</div>
					</div>
					<div class="flex-1"><Field label="Name"><Input name="name" bind:value={name} required /></Field></div>
				</div>
				<Field label="Description">
					<Textarea name="description" rows={2} bind:value={description} />
				</Field>

				<Field label="Color">
					<input type="hidden" name="color" value={color} />
					<div class="flex flex-wrap gap-2">
						{#each PALETTE as c (c)}
							<button type="button" onclick={() => { color = c; dirtyGuard.markDirty(); }} class="mono-focus grid size-7 place-items-center rounded-full" class:ring-2={color === c} style={`background:${c}; --tw-ring-color:${c}`} aria-label={`Pick ${c}`}>{#if color === c}<Check size={14} class="text-white" />{/if}</button>
						{/each}
					</div>
				</Field>

				<Field label="Visibility" hint="Inherit uses the workspace's visibility.">
					<input type="hidden" name="visibility" value={visibility} />
					<div class="flex gap-2">
						{#each ['inherit', 'public', 'private'] as v (v)}
							<button
								type="button"
								onclick={() => { visibility = v as typeof visibility; dirtyGuard.markDirty(); }}
								class={cn(
									'mono-focus flex-1 border px-3 py-2 text-[13px] capitalize transition-colors',
									visibility === v ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--rule)] text-[var(--dim)] hover:text-[var(--text)]'
								)}
							>{v}</button>
						{/each}
					</div>
				</Field>

				<label class="flex items-center gap-2 text-[13px] text-[var(--dim)]">
					<Checkbox name="allowPublicComments" bind:checked={allowPublicComments} />
					Allow logged-in public users to comment
				</label>

				<div class="flex items-center gap-3">
					<Button variant="accent" type="submit">Save changes</Button>
					{#if f?.error}<span class="text-[13px] text-[#f85149]">{f.error}</span>{/if}
				</div>
				<SaveBar dirty={$dirty} saving={savingGeneral} onDiscard={discardGeneral} />
			</form>
		</section>

		<p class="mt-6 border-t border-[var(--rule)] pt-4 text-[13px] text-[var(--dim)]">
			Publish your roadmap, changelog, feedback and more to any site from the
			<a href="?tab=embeds" onclick={(e) => switchTab(e, 'embeds')} class="mono-focus font-medium text-[var(--accent)] hover:underline">Embeds</a> tab.
		</p>
	{:else if tab === 'roadmap'}
		<header class="mb-1">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Roadmap</h2>
		</header>
		<p class="mb-4 text-[13px] text-[var(--dim)]">
			Control the public roadmap. Each board column maps to a lane; choose <em>Hidden</em> to keep a column off the roadmap.
		</p>
		<form
			method="POST"
			action={actionFor('saveRoadmap')}
			use:enhance={() => { savingRoadmap = true; return async ({ update }) => { await update({ reset: false }); savingRoadmap = false; }; }}
			oninput={() => dirtyGuard.markDirty()}
			class="flex flex-col gap-5"
		>
			<label class="flex items-start gap-3">
				<Checkbox name="roadmapEnabled" bind:checked={roadmapEnabled} class="mt-0.5" />
				<span>
					<span class="text-sm font-medium text-[var(--text)]">Show roadmap on the public page</span>
					<span class="block text-xs text-[var(--faint)]">When off, the Roadmap tab and its public URL are hidden.</span>
				</span>
			</label>

			{#if data.roadmap.columns.length}
				<div class="border-t border-[var(--rule)]">
					<div class="flex items-center justify-between border-b border-[var(--rule)] py-2 text-[11px] font-medium tracking-wide text-[var(--faint)] uppercase">
						<span>Column</span><span>Lane</span>
					</div>
					{#each data.roadmap.columns as c (c.id)}
						<div class="flex items-center justify-between gap-3 border-b border-[var(--rule)] py-2.5">
							<span class="flex min-w-0 items-center gap-2">
								<span class="size-2.5 shrink-0 rounded-full" style={`background:${c.color}`}></span>
								<span class="truncate text-sm text-[var(--text)]">{c.name}</span>
							</span>
							<Select
								name={`lane_${c.id}`}
								bind:value={laneOverrides[c.id]}
								options={[{ value: '', label: `Default (${laneLabel(c.defaultLane)})` }, ...ROADMAP_LANES.map((l) => ({ value: l.value, label: l.label }))]}
								size="sm"
								class="w-44 shrink-0"
							/>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-[var(--faint)]">No board columns to configure yet.</p>
			{/if}

			<div class="flex items-center gap-3">
				<Button variant="accent" type="submit" size="sm">Save roadmap</Button>
				{#if data.isPublic}
					<a href={`/${data.workspace.slug}/${data.project.slug}/roadmap`} target="_blank" rel="noreferrer" class="mono-focus ml-auto text-xs font-medium text-[var(--dim)] hover:text-[var(--text)]">View public roadmap →</a>
				{/if}
			</div>
			<SaveBar dirty={$dirty} saving={savingRoadmap} onDiscard={discardRoadmap} />
		</form>
	{:else if tab === 'members'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Collaborators</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Who can access this project, and what they can do.</p>
		</header>
		<section>
			{#if data.members.length}
				<div class="border-t border-[var(--rule)]">
					{#each data.members as m (m.userId)}
						<div class="flex items-center gap-3 border-b border-[var(--rule)] py-2.5">
							<Avatar src={m.avatarUrl} name={m.displayName} size={24} />
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-[var(--text)]">{m.displayName}</p>
								<p class="data-mono truncate text-[var(--faint)]">@{m.username}</p>
							</div>
							<form method="POST" action={actionFor('setRole')} use:enhance>
								<input type="hidden" name="userId" value={m.userId} />
								<Select name="role" value={m.role} options={roleOptions} autosubmit class="w-36" />
							</form>
							<form method="POST" action={actionFor('removeMember')} use:enhance>
								<input type="hidden" name="userId" value={m.userId} />
								<button
									type="submit"
									onclick={(e) => askConfirm(e, 'Remove collaborator?', `${m.displayName} will lose access to this project immediately.`, 'Collaborator removed.')}
									class="hit mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]"
									aria-label="Remove collaborator"
								><Trash2 size={15} /></button>
							</form>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-[var(--faint)]">No collaborators yet.</p>
			{/if}
		</section>

		<section class="mt-8 border-t border-[var(--rule)] pt-6">
			<p class="mb-1 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Invite collaborators</p>
			<p class="mb-4 text-[13px] text-[var(--dim)]">Generate a code that grants a role in this project.</p>
			<form method="POST" action={actionFor('generateInvite')} use:enhance class="flex flex-wrap items-end gap-3">
				<Field label="Role"><Select name="role" value="collaborator" options={roleOptions} /></Field>
				<Field label="Uses"><Input name="maxUses" type="number" min="1" value="1" class="w-20" /></Field>
				<Button variant="accent" type="submit">Generate</Button>
			</form>
			{#if f?.inviteLink}
				<div class="mt-4 flex items-center gap-2 border border-[var(--rule)] p-3">
					<code class="data-mono min-w-0 flex-1 truncate text-[var(--text)]">{f.inviteLink}</code>
					<Button size="sm" variant="ghost" onclick={() => copy(f.inviteLink)}><Copy size={14} /> Copy</Button>
				</div>
			{/if}

			{#if data.invites.length}
				<div class="mt-5 border-t border-[var(--rule)] pt-4">
					<p class="mb-2 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// Active invite codes</p>
					<div>
						{#each data.invites as inv (inv.id)}
							<div class="flex items-center gap-3 border-b border-[var(--rule)] py-2 text-sm last:border-b-0">
								<Badge>{roleLabel(inv.roleGrant)}</Badge>
								<span class="data-mono min-w-0 flex-1 truncate text-[var(--dim)]">{inv.uses}/{inv.maxUses} used{#if inv.note} · {inv.note}{/if}</span>
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
											class="mono-focus rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]"
											aria-label="Delete invite"
										><Trash2 size={14} /></button>
									{/snippet}
								</ConfirmPopover>
							</div>
						{/each}
					</div>
					<p class="mt-2 text-[11px] text-[var(--faint)]">Codes can't be shown again after they're generated — delete and regenerate if one leaks.</p>
				</div>
			{/if}
		</section>
	{:else if tab === 'integrations'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Integrations</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Connect this project to an external issue tracker and announce activity to your channels.</p>
		</header>

		{#each CATEGORY_ORDER as cat (cat)}
			<section class="mb-6">
				<p class="mb-1 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// {CATEGORY_META[cat].label}</p>
				<p class="mb-3 text-xs text-[var(--dim)]">{CATEGORY_META[cat].blurb}</p>
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
			<section class="mt-2 border-t border-[var(--rule)] pt-6">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="mono-display text-sm text-[var(--text)]">{selectedDesc.name}</h3>
					{#if selectedDesc.docsUrl}
						<a href={selectedDesc.docsUrl} target="_blank" rel="noreferrer" class="mono-focus flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"><ExternalLink size={12} /> Docs</a>
					{/if}
				</div>

				{#if selectedIntegration === 'github'}
					<!-- Flattened: one detail panel, hairline dividers between sub-sections. -->
					<div class="flex flex-col gap-6">
						<div>
							<h4 class="flex items-center gap-2 text-sm font-semibold text-[var(--text)]"><GitBranch size={15} class="text-[var(--faint)]" /> Linked repository</h4>
							<p class="mt-1 mb-3 text-[13px] text-[var(--dim)]">Sync issues and pull requests. GitHub is the source of truth on conflicts.</p>
							{#if !data.githubEnabled}
								<p class="border border-[color-mix(in_srgb,var(--amber)_32%,transparent)] bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] p-3 text-[13px] text-[var(--amber)]">The GitHub App isn't configured on this instance yet.</p>
							{:else if data.linkedRepo}
								<div class="flex items-center justify-between border border-[var(--rule)] p-3">
									<a href={`https://github.com/${data.linkedRepo}`} target="_blank" rel="noreferrer" class="mono-focus data-mono flex items-center gap-2 text-[var(--text)] hover:underline"><GitBranch size={14} /> {data.linkedRepo}</a>
									<div class="flex items-center gap-3">
										<form method="POST" action={actionFor('resyncGithub')} use:enhance={() => { resyncing = true; return async ({ update }) => { await update({ reset: false }); resyncing = false; }; }}>
											<button type="submit" disabled={resyncing} class="mono-focus flex items-center gap-1 rounded-[3px] px-1 text-xs text-[var(--dim)] hover:text-[var(--accent)] disabled:opacity-60">
												<RefreshCw size={12} class={resyncing ? 'animate-spin' : ''} /> {resyncing ? 'Resyncing…' : 'Resync'}
											</button>
										</form>
										<form method="POST" action={actionFor('unlinkRepo')} use:enhance>
											<button
												type="submit"
												onclick={(e) => askConfirm(e, 'Unlink repository?', `${data.linkedRepo} will stop syncing with this project. Existing tickets keep their history.`, 'Repository unlinked.')}
												class="mono-focus rounded-[3px] px-1 text-xs text-[var(--faint)] hover:text-[#f85149]"
											>Unlink</button>
										</form>
									</div>
								</div>
								{#if f?.resynced}
									<p class="mt-2 text-[13px] text-[var(--green)]">
										{#if f.missingLocal || f.missingRemote}
											Reconciling{#if f.missingLocal} · {f.missingLocal} issue{f.missingLocal === 1 ? '' : 's'} → OpenTrack{/if}{#if f.missingRemote} · {f.missingRemote} ticket{f.missingRemote === 1 ? '' : 's'} → GitHub{/if}. Changes appear as the sync runs.
										{:else}
											Already in sync — nothing missing on either side.
										{/if}
									</p>
								{:else if f?.error}
									<p class="mt-2 text-[13px] text-[#f85149]">{f.error}</p>
								{/if}
							{:else if data.repos.length}
								<form method="POST" action={actionFor('linkRepo')} use:enhance class="flex items-end gap-2">
									<div class="flex-1"><Select name="repo" bind:value={selectedRepo} options={data.repos} placeholder="Choose a repository…" /></div>
									<Button variant="accent" type="submit" disabled={!selectedRepo}>Link</Button>
								</form>
							{:else}
								<p class="text-[13px] text-[var(--dim)]">No repositories available. Connect a GitHub account in <a href={`/w/${data.workspace.slug}/settings?tab=integrations`} class="mono-focus text-[var(--accent)] hover:underline">workspace settings</a>.</p>
							{/if}
						</div>

						{#if data.linkedRepo}
							<div class="border-t border-[var(--rule)] pt-6">
								<h4 class="text-sm font-semibold text-[var(--text)]">Sync options</h4>
								<p class="mt-1 mb-3 text-[13px] text-[var(--dim)]">Choose which issue facets sync between OpenTrack and GitHub.</p>
								<form
									method="POST"
									action={actionFor('saveGithubSync')}
									use:enhance={() => { savingSync = true; return async ({ update }) => { await update({ reset: false }); savingSync = false; }; }}
									oninput={() => { syncDirty = true; dirtyGuard.markDirty('sync'); }}
									class="flex flex-col gap-3"
								>
									<div class="space-y-1.5">
										<label class="flex items-center gap-2 text-sm text-[var(--text)]">
											<Checkbox name="syncAssignees" bind:checked={syncAssignees} />
											Assignees <span class="text-xs text-[var(--faint)]">— map GitHub assignees to linked accounts (and back)</span>
										</label>
										<label class="flex items-center gap-2 text-sm text-[var(--text)]">
											<Checkbox name="syncLabels" bind:checked={syncLabels} />
											Labels <span class="text-xs text-[var(--faint)]">— mirror issue labels onto tickets</span>
										</label>
										<label class="flex items-center gap-2 text-sm text-[var(--text)]">
											<Checkbox name="syncPriority" bind:checked={syncPriority} />
											Priority <span class="text-xs text-[var(--faint)]">— mirror priority as a <code class="data-mono rounded-[3px] bg-[var(--raised)] px-1 text-[var(--dim)]">priority: …</code> label</span>
										</label>
										<label class="flex items-center gap-2 text-sm text-[var(--text)]">
											<Checkbox name="syncMilestones" bind:checked={syncMilestones} />
											Milestones <span class="text-xs text-[var(--faint)]">— bidirectional milestone sync</span>
										</label>
									</div>
									<div>
										<Button variant="accent" type="submit">Save sync options</Button>
									</div>
									<SaveBar dirty={syncDirty} saving={savingSync} onDiscard={discardSync} />
								</form>
							</div>

							<div class="border-t border-[var(--rule)] pt-6">
								<h4 class="text-sm font-semibold text-[var(--text)]">Progress labels</h4>
								<p class="mt-1 mb-3 text-[13px] text-[var(--dim)]">
									When a ticket enters a selected column, its linked GitHub issue gets a <code class="data-mono rounded-[3px] bg-[var(--raised)] px-1 text-[var(--dim)]">Status: …</code> label (created on GitHub on save). Add newly created lanes here.
								</p>
								<form
									method="POST"
									action={actionFor('saveProgressLabels')}
									use:enhance={() => { savingProgress = true; return async ({ update }) => { await update({ reset: false }); savingProgress = false; }; }}
									class="flex flex-col gap-3"
								>
									<div class="space-y-1.5">
										{#each data.columns as c (c.name)}
											<label class="flex items-center gap-2 text-sm text-[var(--text)]">
												<Checkbox name="progressColumn" value={c.name} checked={progressColumns.includes(c.name)} onchange={(e) => toggleProgress(c.name, (e.currentTarget as HTMLInputElement).checked)} />
												<span class="size-2.5 shrink-0 rounded-full" style={`background:${c.color}`}></span>
												<span class="text-[var(--faint)]">Status:</span> {c.name}
											</label>
										{:else}
											<p class="text-sm text-[var(--faint)]">This project has no board columns.</p>
										{/each}
									</div>
									<div>
										<Button variant="accent" type="submit">Save progress labels</Button>
									</div>
									<SaveBar dirty={progressDirty} saving={savingProgress} onDiscard={discardProgress} />
								</form>
							</div>

							<div class="border-t border-[var(--rule)] pt-6">
								<h4 class="text-sm font-semibold text-[var(--text)]">Close on GitHub</h4>
								<p class="mt-1 mb-3 text-[13px] text-[var(--dim)]">
									When a ticket enters a selected column, its linked GitHub issue is closed (and reopened when moved back out). Leave all unchecked to fall back to the column category (Done / Canceled). Deleting a ticket always closes its issue.
								</p>
								<form
									method="POST"
									action={actionFor('saveCloseColumns')}
									use:enhance={() => { savingClose = true; return async ({ update }) => { await update({ reset: false }); savingClose = false; }; }}
									class="flex flex-col gap-3"
								>
									<div class="space-y-1.5">
										{#each data.columns as c (c.name)}
											<label class="flex items-center gap-2 text-sm text-[var(--text)]">
												<Checkbox name="closeColumn" value={c.name} checked={closeColumnsSel.includes(c.name)} onchange={(e) => toggleClose(c.name, (e.currentTarget as HTMLInputElement).checked)} />
												<span class="size-2.5 shrink-0 rounded-full" style={`background:${c.color}`}></span>
												{c.name}
												{#if !data.closeColumns.length && (c.category === 'done' || c.category === 'canceled')}<span class="text-xs text-[var(--faint)]">(by category)</span>{/if}
											</label>
										{:else}
											<p class="text-sm text-[var(--faint)]">This project has no board columns.</p>
										{/each}
									</div>
									<div>
										<Button variant="accent" type="submit">Save close columns</Button>
									</div>
									<SaveBar dirty={closeDirty} saving={savingClose} onDiscard={discardClose} />
								</form>
							</div>
						{/if}
					</div>
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
					<div class="border border-[color-mix(in_srgb,var(--amber)_32%,transparent)] bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] p-3 text-[13px] text-[var(--amber)]">
						GitLab issue sync is coming soon. The provider is scaffolded and slots into the same abstraction; per-ticket issue mapping and inbound webhooks are still in progress.
					</div>
				{/if}
			</section>
		{/if}
	{:else if tab === 'fields'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Custom fields</h2>
			<p class="mt-0.5 text-[13px] text-[var(--dim)]">Add typed fields that appear on every ticket in this project.</p>
		</header>
		<section>
			{#if localFields.length}
				<div class="mb-4 border-t border-[var(--rule)]">
					{#each localFields as fld (fld.id)}
						<div class="flex items-center gap-3 border-b border-[var(--rule)] py-2">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-[var(--text)]">{fld.name}</p>
								<p class="text-xs text-[var(--faint)]">{FIELD_TYPE_LABELS[fld.type]}{#if fld.type === 'select' && fld.options} · {fld.options.join(', ')}{/if}</p>
							</div>
							<ConfirmPopover message={`Delete the “${fld.name}” field? Existing ticket values are lost.`} onconfirm={() => removeField(fld.id)}>
								{#snippet trigger(props)}
									<button type="button" {...props} class="mono-focus hit rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]" aria-label="Delete field"><Trash2 size={14} /></button>
								{/snippet}
							</ConfirmPopover>
						</div>
					{/each}
				</div>
			{/if}

			<div class="flex flex-wrap items-end gap-2">
				<div class="min-w-40 flex-1"><Field label="Field name"><Input bind:value={fName} placeholder="e.g. Severity" /></Field></div>
				<Field label="Type">
					<Select bind:value={fType} options={CUSTOM_FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))} class="w-36" />
				</Field>
				<Button variant="accent" onclick={addField}><Plus size={15} /> Add</Button>
			</div>
			{#if fType === 'select'}
				<div class="mt-2"><Field label="Options (comma-separated)"><Input bind:value={fOptions} placeholder="Low, Medium, High" /></Field></div>
			{/if}
		</section>
	{:else if tab === 'automation'}
		<header class="mb-1">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Automation</h2>
		</header>
		<p class="mb-4 text-[13px] text-[var(--dim)]">When a trigger fires, run actions automatically. Runs in the background.</p>

		{#if rules.length}
			<section class="mb-8 border-t border-[var(--rule)]">
				{#each rules as r (r.id)}
					<div class="flex items-start gap-3 border-b border-[var(--rule)] py-4">
						<Switch checked={r.enabled} onchange={(v) => setRuleEnabled(r, v)} class="mt-0.5 shrink-0" aria-label={`Toggle rule ${r.name}`} />
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium {r.enabled ? 'text-[var(--text)]' : 'text-[var(--faint)]'}">{r.name}</p>
							<p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
								<span class="data-mono border border-[var(--rule)] px-1.5 py-0.5 text-[var(--dim)]">{trigLabel(r.trigger?.type)}{#if r.trigger?.config?.columnName} → {r.trigger.config.columnName}{/if}{#if r.trigger?.config?.labelId} → {labelName(String(r.trigger.config.labelId))}{/if}{#if r.trigger?.config?.days} ({r.trigger.config.days}d){/if}</span>
								<ArrowRight size={12} class="text-[var(--faint)]" />
								{#each r.actions ?? [] as a (a.type + JSON.stringify(a.config))}<span class="data-mono border border-[color-mix(in_srgb,var(--accent)_38%,transparent)] px-1.5 py-0.5 text-[var(--accent-fg)]">{summariseAction(a)}</span>{/each}
							</p>
						</div>
						<ConfirmPopover message={`Delete the “${r.name}” rule?`} onconfirm={() => deleteRule(r.id)}>
							{#snippet trigger(props)}
								<button type="button" {...props} class="mono-focus hit rounded-[3px] p-1.5 text-[var(--faint)] transition-colors hover:bg-[color-mix(in_srgb,#f85149_12%,transparent)] hover:text-[#f85149]" aria-label="Delete rule"><Trash2 size={14} /></button>
							{/snippet}
						</ConfirmPopover>
					</div>
				{/each}
			</section>
		{/if}

		<section class="border-t border-[var(--rule)] pt-6">
			<p class="mb-3 text-[11px] tracking-[0.18em] text-[var(--faint)] uppercase">// New rule</p>
			<div class="mb-3"><Field label="Name"><Input bind:value={rName} placeholder="e.g. Auto-assign reviews" /></Field></div>

			<div class="mb-3 border border-[var(--rule)] p-3">
				<p class="mb-1.5 text-xs font-medium text-[var(--faint)]">WHEN</p>
				<div class="flex flex-wrap items-center gap-2">
					<Select bind:value={rTrigger} options={WORKFLOW_TRIGGERS.map((t) => ({ value: t.type, label: t.label }))} class="w-56" />
					{#if triggerDef?.config === 'column'}
						<Select bind:value={rTriggerColumn} options={columnOpts} placeholder="column" class="w-40" />
					{:else if triggerDef?.config === 'label'}
						<Select bind:value={rTriggerLabel} options={labelOpts} placeholder="label" class="w-40" />
					{:else if triggerDef?.config === 'days'}
						<Input type="number" value={String(rTriggerDays)} oninput={(e) => (rTriggerDays = Number((e.currentTarget as HTMLInputElement).value) || 0)} class="w-20" /> <span class="text-sm text-[var(--dim)]">days</span>
					{/if}
				</div>
			</div>

			<div class="mb-3 border border-[var(--rule)] p-3">
				<div class="mb-1.5 flex items-center justify-between">
					<p class="text-xs font-medium text-[var(--faint)]">IF (optional)</p>
					<button type="button" onclick={addCond} class="mono-focus text-xs text-[var(--accent)] hover:underline">+ condition</button>
				</div>
				{#each rConds as c, i (i)}
					<div class="mb-1.5 flex flex-wrap items-center gap-2">
						<Select value={c.type} onchange={(v) => { rConds[i] = { type: v, value: '' }; }} options={WORKFLOW_CONDITIONS.map((x) => ({ value: x.type, label: x.label }))} class="w-40" />
						{#if c.type === 'priority'}
							<Select value={c.value} onchange={(v) => { rConds[i].value = v; }} options={priorityOpts} placeholder="priority" class="w-32" />
						{:else}
							<Select value={c.value} onchange={(v) => { rConds[i].value = v; }} options={labelOpts} placeholder="label" class="w-40" />
						{/if}
						<button type="button" onclick={() => (rConds = rConds.filter((_, j) => j !== i))} class="mono-focus text-[var(--faint)] hover:text-[#f85149]" aria-label="Remove"><Trash2 size={13} /></button>
					</div>
				{:else}
					<p class="text-xs text-[var(--faint)]">Always runs (no conditions).</p>
				{/each}
			</div>

			<div class="mb-3 border border-[var(--rule)] p-3">
				<div class="mb-1.5 flex items-center justify-between">
					<p class="text-xs font-medium text-[var(--faint)]">THEN</p>
					<button type="button" onclick={addAction} class="mono-focus text-xs text-[var(--accent)] hover:underline">+ action</button>
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
						<button type="button" onclick={() => (rActs = rActs.filter((_, j) => j !== i))} class="mono-focus text-[var(--faint)] hover:text-[#f85149]" aria-label="Remove"><Trash2 size={13} /></button>
					</div>
				{/each}
			</div>

			<div class="flex items-center gap-3">
				<Button variant="accent" onclick={createRule}><Plus size={15} /> Add rule</Button>
				{#if ruleErr}<span class="text-sm text-[#f85149]">{ruleErr}</span>{/if}
			</div>
		</section>
	{:else if tab === 'embeds'}
		<header class="mb-1">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Embeds</h2>
		</header>
		<p class="mb-5 text-[13px] text-[var(--dim)]">Publish live widgets to any website. Pick a widget, configure it, then copy the snippet. Changes apply after you save.</p>

		{#if !data.isPublic}
			<p class="border border-[color-mix(in_srgb,var(--amber)_32%,transparent)] bg-[color-mix(in_srgb,var(--amber)_12%,transparent)] p-4 text-[13px] text-[var(--amber)]">
				Embeds are only available for public projects. Make this project public in
				<a href="?tab=general" onclick={(e) => switchTab(e, 'general')} class="mono-focus font-medium underline">General</a> to use them.
			</p>
		{:else}
			<form
				method="POST"
				action={actionFor('saveEmbeds')}
				use:enhance={() => { savingEmbeds = true; return async ({ update }) => { await update({ reset: false }); savingEmbeds = false; }; }}
				oninput={() => dirtyGuard.markDirty()}
				class="flex flex-col gap-4"
			>
				<input type="hidden" name="config" value={JSON.stringify(embed)} />

				<div class="grid gap-4 lg:grid-cols-[13rem_1fr]">
					<!-- Widget list — selecting swaps the ONE mounted preview on the right. -->
					<div class="hairline flex flex-row gap-1 overflow-x-auto p-1.5 lg:flex-col lg:overflow-visible">
						{#each EMBED_WIDGETS as w (w.key)}
							<button
								type="button"
								onclick={() => (selectedEmbed = w.key)}
								class={cn(
									'mono-focus flex shrink-0 items-center justify-between gap-2 rounded-[3px] px-2.5 py-2 text-left text-sm transition-colors',
									selectedEmbed === w.key
										? 'bg-[color-mix(in_srgb,var(--text)_8%,transparent)] font-medium text-[var(--text)]'
										: 'text-[var(--dim)] hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-[var(--text)]'
								)}
							>
								<span class="truncate">{w.label}</span>
								<span class={cn('size-1.5 shrink-0 rounded-full', embed[w.key].enabled ? 'bg-[var(--green)]' : 'bg-[var(--rule)]')}></span>
							</button>
						{/each}
						<button
							type="button"
							onclick={() => (selectedEmbed = 'badge')}
							class={cn(
								'mono-focus flex shrink-0 items-center justify-between gap-2 rounded-[3px] px-2.5 py-2 text-left text-sm transition-colors',
								selectedEmbed === 'badge'
									? 'bg-[color-mix(in_srgb,var(--text)_8%,transparent)] font-medium text-[var(--text)]'
									: 'text-[var(--dim)] hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-[var(--text)]'
							)}
						>
							<span class="truncate">Badge</span>
							<span class={cn('size-1.5 shrink-0 rounded-full', embed.badge.enabled ? 'bg-[var(--green)]' : 'bg-[var(--rule)]')}></span>
						</button>
					</div>

					<!-- Detail: config for the selected widget + its one live preview. -->
					<section class="min-w-0 border-t border-[var(--rule)] pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
						{#if selectedEmbed === 'badge'}
							<div class="flex items-start justify-between gap-3">
								<div>
									<h3 class="mono-display text-sm text-[var(--text)]">Badge</h3>
									<p class="mt-0.5 text-xs text-[var(--dim)]">A shields-style badge for READMEs — latest release or count shipped.</p>
								</div>
								<label class="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-[var(--dim)]">
									<Checkbox bind:checked={embed.badge.enabled} /> Enabled
								</label>
							</div>
							{#if embed.badge.enabled}
								<div class="mt-4 grid gap-3 sm:grid-cols-3">
									<label class="flex flex-col gap-1 text-xs font-medium text-[var(--faint)]">Metric
										<Select bind:value={embed.badge.metric} options={badgeMetricOpts} />
									</label>
									<label class="flex flex-col gap-1 text-xs font-medium text-[var(--faint)]">Theme
										<Select bind:value={embed.badge.theme} options={themeOpts} />
									</label>
									<label class="flex flex-col gap-1 text-xs font-medium text-[var(--faint)]">Label
										<Input type="text" bind:value={embed.badge.label} placeholder={embed.badge.metric} />
									</label>
								</div>
								<div class="mt-4">
									<div class="mb-1 flex items-center justify-between">
										<span class="text-xs font-medium text-[var(--faint)]">Markdown / README</span>
										<button type="button" onclick={() => copy(badgeSnip)} class="mono-focus flex items-center gap-1 text-xs text-[var(--dim)] hover:text-[var(--text)]"><Copy size={12} /> Copy</button>
									</div>
									<code class="data-mono block overflow-x-auto border border-[var(--rule)] bg-[var(--raised)] px-2.5 py-2 whitespace-pre text-[var(--dim)]">{badgeSnip}</code>
									{#key embedRev}
										<img src={`${embedBase}/badge.svg?v=${embedRev}`} alt="Badge preview" class="mt-3" />
									{/key}
								</div>
							{/if}
						{:else}
							{@const w = EMBED_WIDGETS.find((x) => x.key === selectedEmbed)}
							{#if w}
								{@const cfg = embed[w.key]}
								{@const iSnip = iframeSnippet(data.origin, data.workspace.slug, data.project.slug, w, data.project.name)}
								<div class="flex items-start justify-between gap-3">
									<div>
										<h3 class="mono-display text-sm text-[var(--text)]">{w.label}</h3>
										<p class="mt-0.5 text-xs text-[var(--dim)]">{w.description}</p>
									</div>
									<label class="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-[var(--dim)]">
										<Checkbox bind:checked={cfg.enabled} /> Enabled
									</label>
								</div>

								{#if cfg.enabled}
									<div class="mt-4 grid gap-3 sm:grid-cols-2">
										<label class="flex flex-col gap-1 text-xs font-medium text-[var(--faint)]">Theme
											<Select bind:value={cfg.theme} options={themeOpts} />
										</label>
										<label class="flex flex-col gap-1 text-xs font-medium text-[var(--faint)]">Max items
											<input type="number" min="1" max="50" bind:value={cfg.limit} class="hairline data-mono h-9 px-3 text-sm" />
										</label>
										<label class="flex flex-col gap-1 text-xs font-medium text-[var(--faint)]">Accent (hex)
											<Input type="text" placeholder={data.projectColor ?? '#6366f1'} value={cfg.accent ?? ''} oninput={(e) => (cfg.accent = e.currentTarget.value.trim() || null)} class="data-mono" />
										</label>
										<div class="flex items-end gap-4 pb-1 text-sm text-[var(--dim)]">
											<label class="flex items-center gap-1.5"><Checkbox bind:checked={cfg.showHeader} /> Header</label>
											<label class="flex items-center gap-1.5"><Checkbox bind:checked={cfg.showFooter} /> Footer</label>
										</div>
									</div>

									{#if w.hasLanes}
										<div class="mt-3">
											<span class="text-xs font-medium text-[var(--faint)]">Lanes</span>
											<div class="mt-1 flex flex-wrap gap-3 text-sm text-[var(--dim)]">
												{#each ROADMAP_LANE_KEYS as lk (lk)}
													<label class="flex items-center gap-1.5"><Checkbox checked={embed.roadmap.lanes.includes(lk)} onchange={() => toggleLane(lk)} /> {ROADMAP_LANE_LABELS[lk]}</label>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Snippets -->
									<div class="mt-4 space-y-2">
										<div>
											<div class="mb-1 flex items-center justify-between">
												<span class="text-xs font-medium text-[var(--faint)]">iframe</span>
												<button type="button" onclick={() => copy(iSnip)} class="mono-focus flex items-center gap-1 text-xs text-[var(--dim)] hover:text-[var(--text)]"><Copy size={12} /> Copy</button>
											</div>
											<code class="data-mono block overflow-x-auto border border-[var(--rule)] bg-[var(--raised)] px-2.5 py-2 whitespace-pre text-[var(--dim)]">{iSnip}</code>
										</div>
										{#if w.svg}
											{@const pSnip = pictureSnippet(data.origin, data.workspace.slug, data.project.slug, w, data.project.name)}
											<div>
												<div class="mb-1 flex items-center justify-between">
													<span class="text-xs font-medium text-[var(--faint)]">Markdown / README (SVG, auto dark)</span>
													<button type="button" onclick={() => copy(pSnip)} class="mono-focus flex items-center gap-1 text-xs text-[var(--dim)] hover:text-[var(--text)]"><Copy size={12} /> Copy</button>
												</div>
												<code class="data-mono block overflow-x-auto border border-[var(--rule)] bg-[var(--raised)] px-2.5 py-2 whitespace-pre text-[var(--dim)]">{pSnip}</code>
											</div>
										{/if}
									</div>

									<!-- The one lazy-mounted preview: swapping the widget selection
									     tears this iframe down and mounts the next one. -->
									<div class="mt-4">
										<div class="mb-1 flex items-center justify-between text-xs text-[var(--faint)]">
											<span>Preview</span>
											<a href={`${embedBase}/${w.path}`} target="_blank" rel="noreferrer" class="mono-focus flex items-center gap-1 text-[var(--accent)] hover:underline">Open <ExternalLink size={11} /></a>
										</div>
										{#key embedRev}
											<iframe src={`${embedBase}/${w.path}?v=${embedRev}`} title={`${w.label} preview`} class="w-full border border-[var(--rule)]" style={`height:${w.height}px`} loading="lazy"></iframe>
										{/key}
									</div>
								{/if}
							{/if}
						{/if}
					</section>
				</div>

				<div class="flex items-center gap-3">
					<Button variant="accent" type="submit">Save embed settings</Button>
					{#if f?.error}<span class="text-sm text-[#f85149]">{f.error}</span>{/if}
				</div>
				<SaveBar dirty={$dirty} saving={savingEmbeds} onDiscard={discardEmbeds} />
			</form>
		{/if}
	{:else if tab === 'danger'}
		<header class="mb-6">
			<h2 class="mono-display text-lg tracking-tight text-[var(--text)]">Danger zone</h2>
		</header>
		<section class="border border-[color-mix(in_srgb,#f85149_35%,transparent)] p-5">
			<h3 class="text-sm font-semibold text-[#f85149]">Delete project</h3>
			<p class="mt-1 mb-3 text-[13px] text-[var(--dim)]">Deleting a project removes its boards, tickets, and suggestions. This cannot be undone.</p>
			<Button variant="danger" onclick={() => (deleteOpen = true)}><Trash2 size={15} /> Delete project</Button>
		</section>
	{/if}
</SettingsShell>

<ConfirmDialog
	bind:open={deleteOpen}
	title="Delete project?"
	description="This permanently removes the project and all of its boards, tickets, and suggestions."
	confirmLabel="Delete project"
	action={actionFor('deleteProject')}
	requireText={data.project.name}
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
